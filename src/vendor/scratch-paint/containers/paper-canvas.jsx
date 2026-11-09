import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import paper from '@scratch/paper';
import {sanitizeSvg} from '@scratch/scratch-svg-renderer';
import Formats from '../lib/format';
import log from '../log/log';

import {stripInvalidPaperData} from '../helper/strip-invalid-paper-data';
import {performSnapshot} from '../helper/undo';
import {undoSnapshot, clearUndoState} from '../reducers/undo';
import {isGroup, ungroupItems} from '../helper/group';
import {applyWorkspaceSettings, clearRaster, convertBackgroundGuideLayer, getRaster, refreshStageFrames, setupLayers, updateTheme} from '../helper/layer';
import {getEditorSettings} from '../../../lib/features.js';
import {clearSelectedItems} from '../reducers/selected-items';
import {
    ART_BOARD_WIDTH, ART_BOARD_HEIGHT, CENTER, MAX_WORKSPACE_BOUNDS, getWorkspaceLimit,
    clampViewBounds, resetZoom, setWorkspaceBounds, zoomToFit, resizeCrosshair
} from '../helper/view';
import {ensureClockwise, scaleWithStrokes} from '../helper/math';
import {clearHoveredItem} from '../reducers/hover';
import {clearPasteOffset} from '../reducers/clipboard';
import {changeFormat} from '../reducers/format';
import {updateViewBounds} from '../reducers/view-bounds';
import {saveZoomLevel, setZoomLevelId} from '../reducers/zoom-levels';

import styles from './paper-canvas.css';

class PaperCanvas extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'clearQueuedImport',
            'setCanvas',
            'setBackdrop',
            'importSvg',
            'initializeSvg',
            'maybeZoomToFit',
            'switchCostume',
            'onViewResize',
            'recalibrateSize',
            'refreshBackdrop',
            'handleFeaturesChanged',
            'handleViewChanged',
            'handleMiddleMouseDown',
            'handleMiddleMouseMove',
            'handleMiddleMouseUp'
        ]);
        this._importGeneration = 0;
        this._isMounted = false;
        this._resizeFrame = null;
        this._resizeObserver = null;
        this._middlePan = null;
        this._middlePanCursor = '';
    }
    componentDidMount () {
        this._isMounted = true;
        paper.setup(this.canvas);
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(this.onViewResize);
            this._resizeObserver.observe(this.canvas);
        }
        paper.view.on('resize', this.onViewResize);
        window.addEventListener('mousedown', this.handleMiddleMouseDown, true);
        window.addEventListener('costume-studio:features-changed', this.handleFeaturesChanged);
        window.addEventListener('costume-studio:view-changed', this.handleViewChanged);
        resetZoom();
        if (this.props.zoomLevelId) {
            this.props.setZoomLevelId(this.props.zoomLevelId);
            if (this.props.zoomLevels[this.props.zoomLevelId]) {
                // This is the matrix that the view should be zoomed to after image import
                this.shouldZoomToFit = this.props.zoomLevels[this.props.zoomLevelId];
            } else {
                // Zoom to fit true means find a comfortable zoom level for viewing the costume
                this.shouldZoomToFit = true;
            }
        } else {
            this.props.updateViewBounds(paper.view.matrix);
        }

        const context = this.canvas.getContext('2d');
        context.webkitImageSmoothingEnabled = false;
        context.imageSmoothingEnabled = false;

        // Don't show handles by default
        paper.settings.handleSize = 0;
        // Make layers.
        setupLayers(this.props.format);
        updateTheme(this.props.theme);
        this.importImage(
            this.props.imageFormat, this.props.image, this.props.rotationCenterX, this.props.rotationCenterY);
        this.refreshBackdrop();
    }
    componentWillReceiveProps (newProps) {
        if (this.props.imageId !== newProps.imageId) {
            this.switchCostume(newProps.imageFormat, newProps.image,
                newProps.rotationCenterX, newProps.rotationCenterY,
                this.props.zoomLevelId, newProps.zoomLevelId);
        }
        if (this.props.format !== newProps.format) {
            this.recalibrateSize();
            convertBackgroundGuideLayer(newProps.format);
            applyWorkspaceSettings(newProps.format);
        }
        if (this.props.theme !== newProps.theme) {
            updateTheme(newProps.theme);
            this.refreshBackdrop(newProps.theme);
        }
    }
    componentWillUnmount () {
        this._isMounted = false;
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._resizeFrame !== null) {
            window.cancelAnimationFrame(this._resizeFrame);
            this._resizeFrame = null;
        }
        window.removeEventListener('costume-studio:features-changed', this.handleFeaturesChanged);
        window.removeEventListener('costume-studio:view-changed', this.handleViewChanged);
        window.removeEventListener('mousedown', this.handleMiddleMouseDown, true);
        this.stopMiddlePan();
        this.clearQueuedImport();
        // shouldZoomToFit means the zoom level hasn't been initialized yet
        if (!this.shouldZoomToFit) {
            this.props.saveZoomLevel();
        }
        paper.remove();
    }
    clearQueuedImport () {
        // Cancel any in-flight async import. importSvg applies its result
        // only while its captured generation still matches this counter, so
        // bumping it makes a late callback bail instead of touching a
        // paper.project that has been removed (unmount) or replaced by a
        // newer import.
        this._importGeneration += 1;
        if (this.queuedImport) {
            window.clearTimeout(this.queuedImport);
            this.queuedImport = null;
        }
        if (this.queuedImageToLoad) {
            this.queuedImageToLoad.src = '';
            this.queuedImageToLoad.onload = null;
            this.queuedImageToLoad = null;
        }
    }
    switchCostume (format, image, rotationCenterX, rotationCenterY, oldZoomLevelId, newZoomLevelId) {
        if (oldZoomLevelId && oldZoomLevelId !== newZoomLevelId) {
            this.props.saveZoomLevel();
        }
        if (newZoomLevelId && oldZoomLevelId !== newZoomLevelId) {
            if (this.props.zoomLevels[newZoomLevelId]) {
                this.shouldZoomToFit = this.props.zoomLevels[newZoomLevelId];
            } else {
                this.shouldZoomToFit = true;
            }
            this.props.setZoomLevelId(newZoomLevelId);
        }
        for (const layer of paper.project.layers) {
            if (layer.data.isRasterLayer) {
                clearRaster();
            } else if (!layer.data.isBackgroundGuideLayer &&
                !layer.data.isDragCrosshairLayer &&
                !layer.data.isOutlineLayer) {
                layer.removeChildren();
            }
        }
        this.props.clearUndo();
        this.props.clearSelectedItems();
        this.props.clearHoveredItem();
        this.props.clearPasteOffset();
        this.importImage(format, image, rotationCenterX, rotationCenterY);
    }
    importImage (format, image, rotationCenterX, rotationCenterY) {
        // Stop any in-progress imports
        this.clearQueuedImport();

        if (!image) {
            this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
            performSnapshot(this.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
            this.recalibrateSize();
            return;
        }

        if (format === 'jpg' || format === 'png') {
            // import bitmap
            this.props.changeFormat(Formats.BITMAP_SKIP_CONVERT);

            const mask = new paper.Shape.Rectangle(getRaster().getBounds());
            mask.guide = true;
            mask.locked = true;
            mask.setPosition(CENTER);
            mask.clipMask = true;

            const imgElement = new Image();
            this.queuedImageToLoad = imgElement;
            imgElement.onload = () => {
                if (!this.queuedImageToLoad) return;
                this.queuedImageToLoad = null;

                if (typeof rotationCenterX === 'undefined') {
                    rotationCenterX = imgElement.width / 2;
                }
                if (typeof rotationCenterY === 'undefined') {
                    rotationCenterY = imgElement.height / 2;
                }

                getRaster().drawImage(
                    imgElement,
                    (ART_BOARD_WIDTH / 2) - rotationCenterX,
                    (ART_BOARD_HEIGHT / 2) - rotationCenterY);
                getRaster().drawImage(
                    imgElement,
                    (ART_BOARD_WIDTH / 2) - rotationCenterX,
                    (ART_BOARD_HEIGHT / 2) - rotationCenterY);

                this.maybeZoomToFit(true /* isBitmap */);
                performSnapshot(this.props.undoSnapshot, Formats.BITMAP_SKIP_CONVERT);
                this.recalibrateSize();
            };
            imgElement.src = image;
        } else if (format === 'svg') {
            this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
            this.importSvg(image, rotationCenterX, rotationCenterY);
        } else {
            log.error(`Didn't recognize format: ${format}. Use 'jpg', 'png' or 'svg'.`);
            this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
            performSnapshot(this.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
            this.recalibrateSize();
        }
    }
    maybeZoomToFit (isBitmapMode) {
        if (this.shouldZoomToFit instanceof paper.Matrix) {
            paper.view.matrix = this.shouldZoomToFit;
            this.props.updateViewBounds(paper.view.matrix);
            resizeCrosshair();
        } else if (this.shouldZoomToFit === true) {
            zoomToFit(isBitmapMode);
        }
        this.shouldZoomToFit = false;
        setWorkspaceBounds();
        this.props.updateViewBounds(paper.view.matrix);
    }
    importSvg (svg, rotationCenterX, rotationCenterY) {
        this._importGeneration += 1;
        const generation = this._importGeneration;

        // Pre-process SVG to prevent parsing errors (discussion from #213)
        // 1. Remove svg: namespace on elements.
        svg = svg.split(/<\s*svg:/).join('<');
        svg = svg.split(/<\/\s*svg:/).join('</');
        // 2. Add root svg namespace if it does not exist.
        const svgAttrs = svg.match(/<svg [^>]*>/);
        if (svgAttrs && svgAttrs[0].indexOf('xmlns=') === -1) {
            svg = svg.replace(
                '<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        }
        // 3. Strip elements and attributes that fire on DOM-insertion.
        // DOMPurify's SVG profile drops <script>, <foreignObject>, <a>,
        // event-handler attrs, and similar. This narrows the input the
        // sandbox sees, providing defense in depth.
        svg = sanitizeSvg.sanitizeSvgText(svg);

        // 4. Parse once and strip data-paper-data values that fail
        // JSON.parse (paper.js synchronously throws on these and aborts
        // the whole import).
        const svgDom = new DOMParser().parseFromString(svg, 'text/xml');
        const modified = stripInvalidPaperData(svgDom);
        if (modified) svg = new XMLSerializer().serializeToString(svgDom);

        // 5. Import directly with Paper.js in this window, like the original
        // Scratch paint editor did before the sandbox was introduced. The
        // sandbox iframe can time out (30s) when its code-split chunks fail
        // to load, which left the canvas blank and later fell back to a
        // low-quality bitmap. Direct import has no such dependency.
        // (Same options as helper/paper-import.js: expandShapes + onLoad/onError.)
        const viewBoxDoc = new DOMParser().parseFromString(svg, 'text/xml');
        const viewBoxAttr = viewBoxDoc.documentElement.getAttribute('viewBox');
        const viewBoxParts = viewBoxAttr ? viewBoxAttr.match(/\S+/g) : null;
        const viewBox = viewBoxParts ? viewBoxParts.map(parseFloat) : null;

        try {
            paper.project.importSVG(svg, {
                expandShapes: true,
                onLoad: item => {
                    if (generation !== this._importGeneration) return;
                    if (!item) {
                        this._handleSvgImportError(new Error('importSVG returned null'), generation, svg);
                        return;
                    }
                    // Wait for embedded rasters to settle, as in paper-import.js.
                    const rasters = item.className === 'Raster' ?
                        [item] :
                        item.getItems({class: paper.Raster});
                    let pending = rasters.length;
                    const finish = () => {
                        if (generation !== this._importGeneration) return;
                        this.queuedImport = this.recalibrateSize(() => {
                            this.props.updateViewBounds(paper.view.matrix);
                            this.initializeSvg(item, rotationCenterX, rotationCenterY, viewBox);
                        });
                    };
                    if (pending === 0) {
                        finish();
                    } else {
                        const onSettled = () => {
                            pending -= 1;
                            if (pending === 0) finish();
                        };
                        rasters.forEach(raster => {
                            raster.on('load', onSettled);
                            raster.on('error', onSettled);
                        });
                    }
                },
                onError: message => {
                    this._handleSvgImportError(new Error(`SVG import error: ${message}`), generation, svg);
                }
            });
        } catch (err) {
            this._handleSvgImportError(err, generation, svg);
        }
    }
    _handleSvgImportError (err, generation, svg) {
                // Discard errors from superseded imports — the newer import
                // is responsible for its own error handling.
                if (generation !== this._importGeneration) return;
                log.error('SVG import failed:', err);
                // Fallback: rasterize the SVG as a bitmap so unsupported
                // vector features still show the artwork instead of a blank
                // canvas. Best effort only.
                try {
                    const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml;charset=utf-8'}));
                    const image = new Image();
                    image.onload = () => {
                        try {
                            if (generation !== this._importGeneration) return;
                            const raster = getRaster();
                            const ctx = raster.canvas.getContext('2d');
                            ctx.imageSmoothingEnabled = false;
                            const w = Math.min(image.naturalWidth || 480, 960);
                            const h = Math.min(image.naturalHeight || 360, 720);
                            ctx.clearRect(0, 0, raster.canvas.width, raster.canvas.height);
                            ctx.drawImage(image, (raster.canvas.width - w) / 2, (raster.canvas.height - h) / 2, w, h);
                            this.props.changeFormat(Formats.BITMAP);
                            performSnapshot(this.props.undoSnapshot, Formats.BITMAP);
                        } catch (fallbackErr) {
                            log.error('SVG raster fallback failed:', fallbackErr);
                        } finally {
                            URL.revokeObjectURL(url);
                        }
                    };
                    image.onerror = () => {
                        URL.revokeObjectURL(url);
                        this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
                        performSnapshot(this.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
                    };
                    image.src = url;
                } catch (fallbackErr) {
                    log.error('SVG raster fallback failed:', fallbackErr);
                    this.props.changeFormat(Formats.VECTOR_SKIP_CONVERT);
                    performSnapshot(this.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
                }
    }
    initializeSvg (item, rotationCenterX, rotationCenterY, viewBox) {
        if (this.queuedImport) this.queuedImport = null;
        const itemWidth = item.bounds.width;
        const itemHeight = item.bounds.height;

        // Get reference to viewbox
        let mask;
        if (item.clipped) {
            for (const child of item.children) {
                if (child.isClipMask()) {
                    mask = child;
                    break;
                }
            }
            mask.clipMask = false;
        } else {
            mask = new paper.Shape.Rectangle(item.bounds);
        }
        mask.guide = true;
        mask.locked = true;
        mask.matrix = new paper.Matrix(); // Identity
        // Set the artwork to get clipped at the max costume size
        const workspaceLimit = getWorkspaceLimit();
        mask.size.height = workspaceLimit.height;
        mask.size.width = workspaceLimit.width;
        mask.setPosition(CENTER);
        paper.project.activeLayer.addChild(mask);
        mask.clipMask = true;

        // Reduce single item nested in groups
        if (item instanceof paper.Group && item.children.length === 1) {
            item = item.reduce();
        }

        ensureClockwise(item);
        scaleWithStrokes(item, 2, new paper.Point()); // Import at 2x

        // Apply rotation center
        if (typeof rotationCenterX !== 'undefined' && typeof rotationCenterY !== 'undefined') {
            let rotationPoint = new paper.Point(rotationCenterX, rotationCenterY);
            if (viewBox && viewBox.length >= 2 && !isNaN(viewBox[0]) && !isNaN(viewBox[1])) {
                rotationPoint = rotationPoint.subtract(viewBox[0], viewBox[1]);
            }
            item.translate(CENTER.subtract(rotationPoint.multiply(2)));
        } else {
            // Center
            item.translate(CENTER.subtract(itemWidth, itemHeight));
        }

        paper.project.activeLayer.insertChild(0, item);
        if (isGroup(item)) {
            // Fixes an issue where we may export empty groups
            for (const child of item.children) {
                if (isGroup(child) && child.children.length === 0) {
                    child.remove();
                }
            }
            ungroupItems([item]);
        }

        performSnapshot(this.props.undoSnapshot, Formats.VECTOR_SKIP_CONVERT);
        this.maybeZoomToFit();
    }
    onViewResize () {
        // Coalesce window and element resize notifications into one layout pass.
        if (this._resizeFrame !== null) return;
        this._resizeFrame = window.requestAnimationFrame(() => {
            this._resizeFrame = null;
            if (!this._isMounted || !paper.view) return;

            // Recalibrate before clamping: view bounds must reflect the canvas's
            // new CSS dimensions, otherwise resizing the code panel can shift
            // the Paper.js coordinate system and misalign pointer input.
            this.recalibrateSize(() => {
                if (!this._isMounted || !paper.view) return;
                setWorkspaceBounds(true /* clipEmpty */);
                clampViewBounds();
                this.props.updateViewBounds(paper.view.matrix);
            });
        });
    }
    recalibrateSize (callback) {
        // Sets the size that Paper thinks the canvas is to the size the canvas element actually is.
        // When these are out of sync, the mouse events in the paint editor don't line up correctly.
        return window.setTimeout(() => {
            // If the component unmounts, the canvas will be removed from the page, detaching paper.view.
            // This could also be called before paper.view exists.
            // In either case, return early if so without running the callback.
            if (!this._isMounted || !paper.view) return;
            // Prevent blurriness caused if the "CSS size" of the element is a float--
            // setting canvas dimensions to floats floors them, but we need to round instead
            const elemSize = paper.DomElement.getSize(paper.view.element);
            elemSize.width = Math.round(elemSize.width);
            elemSize.height = Math.round(elemSize.height);
            paper.view.setViewSize(elemSize);

            if (callback) callback();
        }, 0);
    }
    refreshBackdrop (theme = this.props.theme) {
        // setBackdrop() runs during the initial ref commit, before
        // paper.setup() creates the view. The real setup pass refreshes again.
        if (!this.canvas || !this.backdrop || !paper.view) return;
        const settings = getEditorSettings();
        const canvas = this.canvas;
        const backdrop = this.backdrop;
        if (!settings.infiniteCanvas) {
            backdrop.style.background = '';
            canvas.style.backgroundColor = '';
            canvas.style.backgroundImage = '';
            canvas.style.backgroundSize = '';
            canvas.style.backgroundPosition = '';
            return;
        }
        const dark = theme === 'dark';
        const tile = dark ? '#222222' : '#d9e3f2';
        const base = dark ? '#111111' : '#ffffff';
        const size = Math.max(4, 16 * paper.view.zoom);
        const left = -paper.view.bounds.left * paper.view.zoom;
        const top = -paper.view.bounds.top * paper.view.zoom;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">` +
            `<rect width="16" height="16" fill="${base}"/>` +
            `<rect width="8" height="8" fill="${tile}"/>` +
            `<rect x="8" y="8" width="8" height="8" fill="${tile}"/></svg>`;
        canvas.style.backgroundColor = 'transparent';
        canvas.style.backgroundImage = 'none';
        canvas.style.backgroundSize = '';
        canvas.style.backgroundPosition = '';
        backdrop.style.backgroundColor = base;
        backdrop.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        backdrop.style.backgroundSize = `${size}px ${size}px`;
        backdrop.style.backgroundPosition = `${left}px ${top}px`;
    }
    handleFeaturesChanged () {
        if (!this._isMounted || !paper.view) return;
        applyWorkspaceSettings(this.props.format);
        setWorkspaceBounds(true);
        clampViewBounds();
        this.refreshBackdrop();
        this.props.updateViewBounds(paper.view.matrix);
    }
    handleViewChanged () {
        if (!this._isMounted || !paper.view) return;
        refreshStageFrames();
        this.refreshBackdrop();
    }
    handleMiddleMouseDown (event) {
        if (event.button !== 1 || !paper.view || !this.canvas || !this.canvas.contains(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        this._middlePan = {x: event.clientX, y: event.clientY};
        this._middlePanCursor = this.canvas.style.cursor;
        this.canvas.style.cursor = 'grabbing';
        window.addEventListener('mousemove', this.handleMiddleMouseMove, true);
        window.addEventListener('mouseup', this.handleMiddleMouseUp, true);
    }
    handleMiddleMouseMove (event) {
        if (!this._middlePan || !paper.view) return;
        event.preventDefault();
        const dx = event.clientX - this._middlePan.x;
        const dy = event.clientY - this._middlePan.y;
        this._middlePan.x = event.clientX;
        this._middlePan.y = event.clientY;
        const zoom = paper.view.zoom || 1;
        paper.view.center = paper.view.center.add(
            new paper.Point(-dx / zoom, -dy / zoom)
        );
        paper.view.update();
        setWorkspaceBounds();
        // Do not clamp immediately after changing the view center: Paper's
        // view.bounds can still be one frame behind, which would snap the
        // camera back to the previous position while dragging.
        this.props.updateViewBounds(paper.view.matrix);
    }
    stopMiddlePan () {
        if (!this._middlePan) return;
        this._middlePan = null;
        window.removeEventListener('mousemove', this.handleMiddleMouseMove, true);
        window.removeEventListener('mouseup', this.handleMiddleMouseUp, true);
        if (this.canvas) this.canvas.style.cursor = this._middlePanCursor || '';
    }
    handleMiddleMouseUp () {
        this.stopMiddlePan();
    }
    setBackdrop (element) {
        this.backdrop = element;
        this.refreshBackdrop();
    }
    setCanvas (canvas) {
        this.canvas = canvas;
        if (this.props.canvasRef) {
            this.props.canvasRef(canvas);
        }
        this.refreshBackdrop();
    }
    render () {
        return (
            <div className={styles.canvasBackdrop} ref={this.setBackdrop}>
                <canvas
                    className={styles.paperCanvas}
                    ref={this.setCanvas}
                    style={{cursor: this.props.cursor}}
                    resize="true"
                />
            </div>
        );
    }
}

PaperCanvas.propTypes = {
    canvasRef: PropTypes.func,
    changeFormat: PropTypes.func.isRequired,
    clearHoveredItem: PropTypes.func.isRequired,
    clearPasteOffset: PropTypes.func.isRequired,
    clearSelectedItems: PropTypes.func.isRequired,
    clearUndo: PropTypes.func.isRequired,
    cursor: PropTypes.string,
    format: PropTypes.oneOf(Object.keys(Formats)),
    image: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.instanceOf(HTMLImageElement)
    ]),
    imageFormat: PropTypes.string, // The incoming image's data format, used during import. The user could switch this.
    imageId: PropTypes.string,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    saveZoomLevel: PropTypes.func.isRequired,
    setZoomLevelId: PropTypes.func.isRequired,
    theme: PropTypes.string,
    undoSnapshot: PropTypes.func.isRequired,
    updateViewBounds: PropTypes.func.isRequired,
    zoomLevelId: PropTypes.string,
    zoomLevels: PropTypes.shape({
        currentZoomLevelId: PropTypes.string
    })
};
const mapStateToProps = state => ({
    mode: state.scratchPaint.mode,
    cursor: state.scratchPaint.cursor,
    format: state.scratchPaint.format,
    zoomLevels: state.scratchPaint.zoomLevels
});
const mapDispatchToProps = dispatch => ({
    undoSnapshot: snapshot => {
        dispatch(undoSnapshot(snapshot));
    },
    clearUndo: () => {
        dispatch(clearUndoState());
    },
    clearSelectedItems: () => {
        dispatch(clearSelectedItems());
    },
    clearHoveredItem: () => {
        dispatch(clearHoveredItem());
    },
    clearPasteOffset: () => {
        dispatch(clearPasteOffset());
    },
    changeFormat: format => {
        dispatch(changeFormat(format));
    },
    saveZoomLevel: () => {
        dispatch(saveZoomLevel(paper.view.matrix));
    },
    setZoomLevelId: zoomLevelId => {
        dispatch(setZoomLevelId(zoomLevelId));
    },
    updateViewBounds: matrix => {
        dispatch(updateViewBounds(matrix));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PaperCanvas);
