import paper from '@scratch/paper';
import log from '../log/log';
import {ART_BOARD_BOUNDS, ART_BOARD_WIDTH, ART_BOARD_HEIGHT, CENTER, MAX_WORKSPACE_BOUNDS, getRepeatedStageBounds, getStageBounds} from './view';
import {getEditorSettings} from '../../../lib/features.js';
import {isGroupItem} from './item';
import {isBitmap, isVector} from '../lib/format';

const CHECKERBOARD_SIZE = 8;
const CROSSHAIR_SIZE = 16;
const CROSSHAIR_FULL_OPACITY = 0.75;

const _getLayer = function (layerString) {
    for (const layer of paper.project.layers) {
        if (layer.data && layer.data[layerString]) {
            return layer;
        }
    }
};

const _getPaintingLayer = function () {
    return _getLayer('isPaintingLayer');
};

/**
 * Creates a canvas with width and height matching the art board size.
 * @param {?number} width Width of the canvas. Defaults to ART_BOARD_WIDTH.
 * @param {?number} height Height of the canvas. Defaults to ART_BOARD_HEIGHT.
 * @return {HTMLCanvasElement} the canvas
 */
const createCanvas = function (width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width ? width : ART_BOARD_WIDTH;
    canvas.height = height ? height : ART_BOARD_HEIGHT;
    canvas.getContext('2d').imageSmoothingEnabled = false;
    return canvas;
};

const clearRaster = function () {
    const layer = _getLayer('isRasterLayer');
    layer.removeChildren();
    
    // Generate blank raster
    const raster = new paper.Raster(createCanvas());
    raster.canvas.getContext('2d').imageSmoothingEnabled = false;
    raster.parent = layer;
    raster.guide = true;
    raster.locked = true;
    raster.position = CENTER;
};

const getRaster = function () {
    const layer = _getLayer('isRasterLayer');
    // Generate blank raster
    if (layer.children.length === 0) {
        clearRaster();
    }
    return _getLayer('isRasterLayer').children[0];
};

const getDragCrosshairLayer = function () {
    return _getLayer('isDragCrosshairLayer');
};

const getBackgroundGuideLayer = function () {
    return _getLayer('isBackgroundGuideLayer');
};

const getOutlineLayer = function () {
    return _getLayer('isOutlineLayer');
};

const _convertLayer = function (layer, format) {
    layer.bitmapBackground.visible = isBitmap(format);
    layer.vectorBackground.visible = isVector(format);
};

const convertBackgroundGuideLayer = function (format) {
    _convertLayer(getBackgroundGuideLayer(), format);
};

const _makeGuideLayer = function () {
    const guideLayer = new paper.Layer();
    guideLayer.data.isGuideLayer = true;
    return guideLayer;
};

const getGuideLayer = function () {
    let layer = _getLayer('isGuideLayer');
    if (!layer) {
        layer = _makeGuideLayer();
        _getPaintingLayer().activate();
    }
    return layer;
};

const setGuideItem = function (item) {
    item.locked = true;
    item.guide = true;
    if (isGroupItem(item)) {
        for (let i = 0; i < item.children.length; i++) {
            setGuideItem(item.children[i]);
        }
    }
};

/**
 * Removes the guide layers, e.g. for purposes of exporting the image. Must call showGuideLayers to re-add them.
 * @param {boolean} includeRaster true if the raster layer should also be hidden
 * @return {object} an object of the removed layers, which should be passed to showGuideLayers to re-add them.
 */
const hideGuideLayers = function (includeRaster) {
    const backgroundGuideLayer = getBackgroundGuideLayer();
    const dragCrosshairLayer = getDragCrosshairLayer();
    const outlineLayer = _getLayer('isOutlineLayer');
    const guideLayer = getGuideLayer();
    dragCrosshairLayer.remove();
    outlineLayer.remove();
    guideLayer.remove();
    backgroundGuideLayer.remove();
    let rasterLayer;
    if (includeRaster) {
        rasterLayer = _getLayer('isRasterLayer');
        rasterLayer.remove();
    }
    return {
        dragCrosshairLayer: dragCrosshairLayer,
        outlineLayer: outlineLayer,
        guideLayer: guideLayer,
        backgroundGuideLayer: backgroundGuideLayer,
        rasterLayer: rasterLayer
    };
};

/**
 * Add back the guide layers removed by calling hideGuideLayers. This must be done before any editing operations are
 * taken in the paint editor.
 * @param {!object} guideLayers object of the removed layers, which was returned by hideGuideLayers
 */
const showGuideLayers = function (guideLayers) {
    const backgroundGuideLayer = guideLayers.backgroundGuideLayer;
    const dragCrosshairLayer = guideLayers.dragCrosshairLayer;
    const outlineLayer = guideLayers.outlineLayer;
    const guideLayer = guideLayers.guideLayer;
    const rasterLayer = guideLayers.rasterLayer;
    if (rasterLayer && !rasterLayer.index) {
        paper.project.addLayer(rasterLayer);
        rasterLayer.sendToBack();
    }
    if (!backgroundGuideLayer.index) {
        paper.project.addLayer(backgroundGuideLayer);
        backgroundGuideLayer.sendToBack();
    }
    if (!dragCrosshairLayer.index) {
        paper.project.addLayer(dragCrosshairLayer);
        dragCrosshairLayer.bringToFront();
    }
    if (!outlineLayer.index) {
        paper.project.addLayer(outlineLayer);
        outlineLayer.bringToFront();
    }
    if (!guideLayer.index) {
        paper.project.addLayer(guideLayer);
        guideLayer.bringToFront();
    }
    if (paper.project.activeLayer !== _getPaintingLayer()) {
        log.error(`Wrong active layer`);
        log.error(paper.project.activeLayer.data);
    }
};

const _makePaintingLayer = function () {
    const paintingLayer = new paper.Layer();
    paintingLayer.data.isPaintingLayer = true;
    return paintingLayer;
};

const _makeRasterLayer = function () {
    const rasterLayer = new paper.Layer();
    rasterLayer.data.isRasterLayer = true;
    clearRaster();
    return rasterLayer;
};

const BACKGROUND_LIGHT = '#FFFFFF';
const BACKGROUND_TILE_LIGHT = '#D9E3F2';
const BACKGROUND_DARK = '#111';
const BACKGROUND_TILE_DARK = '#222';

const _makeBackgroundPaper = function (width, height, opacity) {
    // creates a checkerboard path of width * height squares in color on white
    let x = 0;
    let y = 0;
    const pathPoints = [];
    while (x < width) {
        pathPoints.push(new paper.Point(x, y));
        x++;
        pathPoints.push(new paper.Point(x, y));
        y = y === 0 ? height : 0;
    }
    y = height - 1;
    x = width;
    while (y > 0) {
        pathPoints.push(new paper.Point(x, y));
        x = (x === 0 ? width : 0);
        pathPoints.push(new paper.Point(x, y));
        y--;
    }
    const vRect = new paper.Shape.Rectangle(
        new paper.Point(0, 0),
        new paper.Point(ART_BOARD_WIDTH / CHECKERBOARD_SIZE, ART_BOARD_HEIGHT / CHECKERBOARD_SIZE));
    vRect.fillColor = BACKGROUND_LIGHT;
    vRect.guide = true;
    vRect.locked = true;
    vRect.position = CENTER;
    const vPath = new paper.Path(pathPoints);
    vPath.fillRule = 'evenodd';
    vPath.fillColor = BACKGROUND_TILE_LIGHT;
    vPath.opacity = opacity;
    vPath.guide = true;
    vPath.locked = true;
    vPath.position = CENTER;
    const mask = new paper.Shape.Rectangle(MAX_WORKSPACE_BOUNDS);
    mask.position = CENTER;
    mask.guide = true;
    mask.locked = true;
    mask.scale(1 / CHECKERBOARD_SIZE);
    const vGroup = new paper.Group([vRect, vPath, mask]);
    mask.clipMask = true;
    return vGroup;
};

const CROSSHAIR_INNER_LIGHT = '#000000';
const CROSSHAIR_OUTER_LIGHT = '#FFFFFF';

// Helper function for drawing a crosshair
const _makeCrosshair = function (opacity, parent) {
    const crosshair = new paper.Group();

    const vLine2 = new paper.Path.Line(new paper.Point(0, -7), new paper.Point(0, 7));
    vLine2.strokeWidth = 6;
    vLine2.strokeColor = CROSSHAIR_OUTER_LIGHT;
    vLine2.strokeCap = 'round';
    crosshair.addChild(vLine2);
    const hLine2 = new paper.Path.Line(new paper.Point(-7, 0), new paper.Point(7, 0));
    hLine2.strokeWidth = 6;
    hLine2.strokeColor = CROSSHAIR_OUTER_LIGHT;
    hLine2.strokeCap = 'round';
    crosshair.addChild(hLine2);
    const circle2 = new paper.Shape.Circle(new paper.Point(0, 0), 5.5);
    circle2.strokeWidth = 6;
    circle2.strokeColor = CROSSHAIR_OUTER_LIGHT;
    crosshair.addChild(circle2);

    const vLine = new paper.Path.Line(new paper.Point(0, -7), new paper.Point(0, 7));
    vLine.strokeWidth = 2;
    vLine.strokeColor = CROSSHAIR_INNER_LIGHT;
    vLine.strokeCap = 'round';
    crosshair.addChild(vLine);
    const hLine = new paper.Path.Line(new paper.Point(-7, 0), new paper.Point(7, 0));
    hLine.strokeWidth = 2;
    hLine.strokeColor = CROSSHAIR_INNER_LIGHT;
    hLine.strokeCap = 'round';
    crosshair.addChild(hLine);
    const circle = new paper.Shape.Circle(new paper.Point(0, 0), 5.5);
    circle.strokeWidth = 2;
    circle.strokeColor = CROSSHAIR_INNER_LIGHT;
    crosshair.addChild(circle);

    setGuideItem(crosshair);
    crosshair.position = CENTER;
    crosshair.opacity = opacity;
    crosshair.parent = parent;
    crosshair.applyMatrix = false;
    parent.dragCrosshair = crosshair;
    crosshair.scale(CROSSHAIR_SIZE / crosshair.bounds.width / paper.view.zoom);
};

const _makeDragCrosshairLayer = function () {
    const dragCrosshairLayer = new paper.Layer();
    _makeCrosshair(CROSSHAIR_FULL_OPACITY, dragCrosshairLayer);
    dragCrosshairLayer.data.isDragCrosshairLayer = true;
    dragCrosshairLayer.visible = false;
    return dragCrosshairLayer;
};

const OUTLINE_INNER_LIGHT = '#FFFFFF';
const OUTLINE_OUTER_LIGHT = '#4280D7';
const OUTLINE_INNER_DARK = '#555555';

const _makeStageFrame = function (bounds, isPrimary, column, row, showLabel) {
    const frame = new paper.Group();
    if (isPrimary) {
        const whiteRect = new paper.Shape.Rectangle(bounds.expand(1));
        whiteRect.strokeWidth = 2;
        whiteRect.strokeColor = OUTLINE_INNER_LIGHT;
        setGuideItem(whiteRect);
        frame.addChild(whiteRect);

        const blueRect = new paper.Shape.Rectangle(bounds.expand(5));
        blueRect.strokeWidth = 2;
        blueRect.strokeColor = OUTLINE_OUTER_LIGHT;
        blueRect.opacity = 0.25;
        setGuideItem(blueRect);
        frame.addChild(blueRect);
    } else {
        // Repeated frames are intentionally faint so they guide without
        // competing with the artwork.
        const rect = new paper.Shape.Rectangle(bounds);
        rect.strokeWidth = Math.max(0.5, 1.2 / paper.view.zoom);
        rect.strokeColor = OUTLINE_OUTER_LIGHT;
        rect.opacity = 0.22;
        setGuideItem(rect);
        frame.addChild(rect);
    }
    if (showLabel) {
        const zoom = paper.view.zoom || 1;
        const label = new paper.PointText({
            content: `${column},${row}`,
            fillColor: OUTLINE_OUTER_LIGHT,
            fontSize: Math.max(2, 9 / zoom),
            opacity: 0.55,
            point: [bounds.left + (4 / zoom), bounds.top + (12 / zoom)]
        });
        label.fontFamily = 'sans-serif';
        setGuideItem(label);
        frame.addChild(label);
    }
    // Mark the whole group as a guide. Marking only the child rectangles
    // leaves the group itself selectable in the paint editor.
    setGuideItem(frame);
    return frame;
};

const refreshStageFrames = function () {
    const outlineLayer = _getLayer('isOutlineLayer');
    if (!outlineLayer) return;
    outlineLayer.removeChildren();
    const stage = getStageBounds();
    const settings = getEditorSettings();
    for (const frameBounds of getRepeatedStageBounds()) {
        const column = Math.round((frameBounds.center.x - stage.center.x) / stage.width);
        // Paper's Y axis points down; the UI labels rows upward from the
        // central stage, so a frame above the center is row 1.
        const row = Math.round((stage.center.y - frameBounds.center.y) / stage.height);
        const primary = column === 0 && row === 0;
        outlineLayer.addChild(_makeStageFrame(
            frameBounds,
            primary,
            column,
            row,
            settings.repeatStage
        ));
    }
    outlineLayer.bringToFront();
};

const applyWorkspaceSettings = function (format) {
    const backgroundGuideLayer = getBackgroundGuideLayer();
    if (backgroundGuideLayer) {
        const settings = getEditorSettings();
        if (settings.infiniteCanvas) {
            backgroundGuideLayer.vectorBackground.visible = false;
            backgroundGuideLayer.bitmapBackground.visible = false;
        } else if (format) {
            _convertLayer(backgroundGuideLayer, format);
        }
    }
    refreshStageFrames();
};

const _makeOutlineLayer = function () {
    const outlineLayer = new paper.Layer();
    outlineLayer.data.isOutlineLayer = true;
    outlineLayer.locked = true;
    refreshStageFrames();
    return outlineLayer;
};

const WORKSPACE_BOUNDS_LIGHT = '#ECF1F9';
const WORKSPACE_BOUNDS_DARK = '#333';

const _makeBackgroundGuideLayer = function (format) {
    const guideLayer = new paper.Layer();
    guideLayer.locked = true;
    
    const vWorkspaceBounds = new paper.Shape.Rectangle(MAX_WORKSPACE_BOUNDS);
    vWorkspaceBounds.fillColor = WORKSPACE_BOUNDS_LIGHT;
    vWorkspaceBounds.position = CENTER;

    // Add 1 to the height because it's an odd number otherwise, and we want it to be even
    // so the corner of the checkerboard to line up with the center crosshair
    const vBackground = _makeBackgroundPaper(
        MAX_WORKSPACE_BOUNDS.width / CHECKERBOARD_SIZE,
        (MAX_WORKSPACE_BOUNDS.height / CHECKERBOARD_SIZE) + 1,
        0.55);
    vBackground.position = CENTER;
    vBackground.scaling = new paper.Point(CHECKERBOARD_SIZE, CHECKERBOARD_SIZE);

    const vectorBackground = new paper.Group();
    vectorBackground.addChild(vWorkspaceBounds);
    vectorBackground.addChild(vBackground);
    setGuideItem(vectorBackground);
    guideLayer.vectorBackground = vectorBackground;

    const bitmapBackground = _makeBackgroundPaper(
        ART_BOARD_WIDTH / CHECKERBOARD_SIZE,
        ART_BOARD_HEIGHT / CHECKERBOARD_SIZE,
        0.55);
    bitmapBackground.position = CENTER;
    bitmapBackground.scaling = new paper.Point(CHECKERBOARD_SIZE, CHECKERBOARD_SIZE);
    bitmapBackground.guide = true;
    bitmapBackground.locked = true;
    guideLayer.bitmapBackground = bitmapBackground;

    _convertLayer(guideLayer, format);
    
    _makeCrosshair(0.16, guideLayer);

    guideLayer.data.isBackgroundGuideLayer = true;
    return guideLayer;
};

const updateTheme = function (theme) {
    const isDark = theme === 'dark';

    const backgroundGuideLayer = getBackgroundGuideLayer();
    const bitmapChildren = backgroundGuideLayer.bitmapBackground.children;
    bitmapChildren[0].fillColor = isDark ? BACKGROUND_DARK : BACKGROUND_LIGHT;
    bitmapChildren[1].fillColor = isDark ? BACKGROUND_TILE_DARK : BACKGROUND_TILE_LIGHT;

    const vectorChildren = backgroundGuideLayer.vectorBackground.children;
    vectorChildren[0].fillColor = isDark ? WORKSPACE_BOUNDS_DARK : WORKSPACE_BOUNDS_LIGHT;
    vectorChildren[1].children[0].fillColor = isDark ? BACKGROUND_DARK : BACKGROUND_LIGHT;
    vectorChildren[1].children[1].fillColor = isDark ? BACKGROUND_TILE_DARK : BACKGROUND_TILE_LIGHT;

    const outlineLayer = getOutlineLayer();
    if (outlineLayer && outlineLayer.children[0] && outlineLayer.children[0].children[0]) {
        outlineLayer.children[0].children[0].strokeColor = isDark ? OUTLINE_INNER_DARK : OUTLINE_INNER_LIGHT;
    }
    refreshStageFrames();
};

const setupLayers = function (format) {
    const backgroundGuideLayer = _makeBackgroundGuideLayer(format);
    _makeRasterLayer();
    const paintLayer = _makePaintingLayer();
    const dragCrosshairLayer = _makeDragCrosshairLayer();
    const outlineLayer = _makeOutlineLayer();
    const guideLayer = _makeGuideLayer();
    backgroundGuideLayer.sendToBack();
    dragCrosshairLayer.bringToFront();
    outlineLayer.bringToFront();
    guideLayer.bringToFront();
    paintLayer.activate();
    applyWorkspaceSettings(format);
};

export {
    CROSSHAIR_SIZE,
    CROSSHAIR_FULL_OPACITY,
    createCanvas,
    hideGuideLayers,
    showGuideLayers,
    getDragCrosshairLayer,
    getGuideLayer,
    getBackgroundGuideLayer,
    convertBackgroundGuideLayer,
    clearRaster,
    getRaster,
    applyWorkspaceSettings,
    refreshStageFrames,
    setGuideItem,
    updateTheme,
    setupLayers
};
