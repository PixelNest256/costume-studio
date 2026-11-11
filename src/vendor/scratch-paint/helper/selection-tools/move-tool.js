import paper from '@scratch/paper';
import Modes, {BitmapModes} from '../../lib/modes';
import {isGroup} from '../group';
import {isCompoundPathItem, getRootItem} from '../item';
import {checkPointsClose, snapDeltaToAngle} from '../math';
import {getActionBounds, CENTER, getRepeatedStageBounds} from '../view';
import {
    clearSelection, cloneSelection, getSelectedLeafItems, getSelectedRootItems, setItemSelection
} from '../selection';
import {getDragCrosshairLayer, getGuideLayer, CROSSHAIR_FULL_OPACITY} from '../layer';
import {createPathText, findPathTextTarget, layoutPathText} from '../path-text';
import {SNAP_GUIDE_COLOR, SNAP_THRESHOLD, loadSnapSettings} from '../snap-settings';

// Snap behavior independently implemented in this file. Initial defaults are
// based on Paint-snap's documented editor behavior (page/object guides, threshold 10); no addon source is bundled.
const FADE_DISTANCE = 10;
const PATH_TEXT_THRESHOLD = 24;
const PATH_TEXT_DETACH_THRESHOLD = 48;
const PATH_TEXT_REARM_THRESHOLD = PATH_TEXT_THRESHOLD * 1.5;

const createSnapPoints = (selectionBounds, objects, settings) => {
    const fromPoints = {};
    if (settings.snapBoxCenter) fromPoints.center = selectionBounds.center;
    if (settings.snapBoxCorners) {
        fromPoints.topLeft = selectionBounds.topLeft;
        fromPoints.topRight = selectionBounds.topRight;
        fromPoints.bottomLeft = selectionBounds.bottomLeft;
        fromPoints.bottomRight = selectionBounds.bottomRight;
    }
    if (settings.snapBoxEdgeMids) {
        fromPoints.left = new paper.Point(selectionBounds.left, selectionBounds.center.y);
        fromPoints.right = new paper.Point(selectionBounds.right, selectionBounds.center.y);
        fromPoints.top = new paper.Point(selectionBounds.center.x, selectionBounds.top);
        fromPoints.bottom = new paper.Point(selectionBounds.center.x, selectionBounds.bottom);
    }
    const toPoints = {};
    const stageBoundsList = getRepeatedStageBounds();
    for (let stageIndex = 0; stageIndex < stageBoundsList.length; stageIndex++) {
        const stage = stageBoundsList[stageIndex];
        const suffix = stageIndex === 0 ? '' : `_${stageIndex}`;
        const key = name => `${name}${suffix}`;
        if (settings.snapPageCenter) {
            toPoints[key('bounds_c')] = {type: 'point', value: stage.center};
        }
        if (settings.snapPageAxes) {
            toPoints[key('bounds_cx')] = {type: 'xcoord', value: stage.center.x};
            toPoints[key('bounds_cy')] = {type: 'ycoord', value: stage.center.y};
        }
        if (settings.snapPageEdges) {
            toPoints[key('bounds_l')] = {type: 'xcoord', value: stage.left, clamp: {min: stage.top, max: stage.bottom}};
            toPoints[key('bounds_r')] = {type: 'xcoord', value: stage.right, clamp: {min: stage.top, max: stage.bottom}};
            toPoints[key('bounds_t')] = {type: 'ycoord', value: stage.top, clamp: {min: stage.left, max: stage.right}};
            toPoints[key('bounds_b')] = {type: 'ycoord', value: stage.bottom, clamp: {min: stage.left, max: stage.right}};
            toPoints[key('bounds_lc')] = {type: 'point', value: new paper.Point(stage.left, stage.center.y)};
            toPoints[key('bounds_rc')] = {type: 'point', value: new paper.Point(stage.right, stage.center.y)};
            toPoints[key('bounds_tc')] = {type: 'point', value: new paper.Point(stage.center.x, stage.top)};
            toPoints[key('bounds_bc')] = {type: 'point', value: new paper.Point(stage.center.x, stage.bottom)};
        }
        if (settings.snapPageCorners) {
            toPoints[key('bounds_tl')] = {type: 'point', value: stage.topLeft};
            toPoints[key('bounds_tr')] = {type: 'point', value: stage.topRight};
            toPoints[key('bounds_bl')] = {type: 'point', value: stage.bottomLeft};
            toPoints[key('bounds_br')] = {type: 'point', value: stage.bottomRight};
        }
    }
    for (const item of objects) {
        if (item.selected || item.data.isHelperItem || item.locked || item.guide) continue;
        if (settings.snapObjectEdges) {
            toPoints[`item_${item.id}_r`] = {type: 'itemSideVert', value: item.bounds.right, clamp: {min: item.bounds.top, max: item.bounds.bottom}};
            toPoints[`item_${item.id}_l`] = {type: 'itemSideVert', value: item.bounds.left, clamp: {min: item.bounds.top, max: item.bounds.bottom}};
            toPoints[`item_${item.id}_t`] = {type: 'itemSideHoriz', value: item.bounds.top, clamp: {min: item.bounds.left, max: item.bounds.right}};
            toPoints[`item_${item.id}_b`] = {type: 'itemSideHoriz', value: item.bounds.bottom, clamp: {min: item.bounds.left, max: item.bounds.right}};
        }
        if (settings.snapObjectCenters) {
            toPoints[`item_${item.id}_c`] = {type: 'point', value: item.bounds.center};
        }
        if (settings.snapObjectMidlines) {
            toPoints[`item_${item.id}_cx`] = {type: 'xcoord', value: item.bounds.center.x};
            toPoints[`item_${item.id}_cy`] = {type: 'ycoord', value: item.bounds.center.y};
        }
        if (settings.snapObjectCorners) {
            toPoints[`item_${item.id}_tl`] = {type: 'point', value: item.bounds.topLeft};
            toPoints[`item_${item.id}_tr`] = {type: 'point', value: item.bounds.topRight};
            toPoints[`item_${item.id}_bl`] = {type: 'point', value: item.bounds.bottomLeft};
            toPoints[`item_${item.id}_br`] = {type: 'point', value: item.bounds.bottomRight};
        }
    }
    return {from: fromPoints, to: toPoints};
};

/**
 * Tool to handle dragging an item to reposition it in a selection mode.
 */
class MoveTool {
    /**
     * @param {Modes} mode Paint editor mode
     * @param {function} setSelectedItems Callback to set the set of selected items in the Redux state
     * @param {function} clearSelectedItems Callback to clear the set of selected items in the Redux state
     * @param {!Function} onUpdateImage A callback to call when the image visibly changes
     * @param {?Function} switchToTextTool A callback to call to switch to the text tool
     */
    constructor (mode, setSelectedItems, clearSelectedItems, onUpdateImage, switchToTextTool) {
        this.mode = mode;
        this.setSelectedItems = setSelectedItems;
        this.clearSelectedItems = clearSelectedItems;
        this.selectedItems = null;
        this.selectionCenter = null;
        this.onUpdateImage = onUpdateImage;
        this.switchToTextTool = switchToTextTool;
        this.boundsPath = null;
        this.firstDrag = false;
        this._pathText = null;
        this._pathTextArmed = true;
        this._pathTextDetachedPath = null;
    }

    /**
     * @param {!object} hitProperties Describes the mouse event
     * @param {!paper.HitResult} hitProperties.hitResult Data about the location of the mouse click
     * @param {?boolean} hitProperties.clone Whether to clone on mouse down (e.g. alt key held)
     * @param {?boolean} hitProperties.multiselect Whether to multiselect on mouse down (e.g. shift key held)
     * @param {?boolean} hitProperties.doubleClicked True if this is the second click in a short amount of time
     * @param {?boolean} hitProperties.subselect True if we allow selection of subgroups, false if we should
     *     select the whole group.
     */
    onMouseDown (hitProperties) {
        let item = hitProperties.hitResult.item;
        if (!hitProperties.subselect) {
            const root = getRootItem(hitProperties.hitResult.item);
            item = isCompoundPathItem(root) || isGroup(root) ? root : hitProperties.hitResult.item;
        }
        if (item.selected) {
            // Double click causes all points to be selected in subselect mode. If the target is text, it
            // enters text edit.
            if (hitProperties.doubleClicked) {
                if (!hitProperties.multiselect) {
                    if (this.switchToTextTool && item instanceof paper.PointText) {
                        this.switchToTextTool();
                        return;
                    }
                    clearSelection(this.clearSelectedItems);
                }
                this._select(item, true /* state */, hitProperties.subselect, true /* fullySelect */);
            } else if (hitProperties.multiselect) {
                this._select(item, false /* state */, hitProperties.subselect);
            }
        } else {
            // deselect all by default if multiselect isn't on
            if (!hitProperties.multiselect) {
                clearSelection(this.clearSelectedItems);
            }
            this._select(item, true, hitProperties.subselect);
        }
        if (hitProperties.clone) cloneSelection(hitProperties.subselect, this.onUpdateImage);

        this.selectedItems = this.mode === Modes.RESHAPE ? getSelectedLeafItems() : getSelectedRootItems();
        if (this.selectedItems.length === 0) {
            return;
        }

        let selectionBounds;
        for (const selectedItem of this.selectedItems) {
            if (selectionBounds) {
                selectionBounds = selectionBounds.unite(selectedItem.bounds);
            } else {
                selectionBounds = selectedItem.bounds;
            }
        }
        this.selectionCenter = selectionBounds.center;
        this._selectionBounds = selectionBounds;

        if (this.boundsPath) {
            this.selectedItems.push(this.boundsPath);
        }

        this.firstDrag = true;
        this._pathTextArmed = true;
        this._pathTextDetachedPath = null;
    }
    setBoundsPath (boundsPath) {
        this.boundsPath = boundsPath;
    }
    /**
     * Sets the selection state of an item.
     * @param {!paper.Item} item Item to select or deselect
     * @param {?boolean} state True if item should be selected, false if deselected
     * @param {?boolean} subselect True if a subset of all points in an item are allowed to be
     *     selected, false if items must be selected all or nothing.
     * @param {?boolean} fullySelect True if in addition to the item being selected, all of its
     *     control points should be selected. False if the item should be selected but not its
     *     points. Only relevant when subselect is true.
     */
    _select (item, state, subselect, fullySelect) {
        if (subselect) {
            item.selected = false;
            if (fullySelect) {
                item.fullySelected = state;
            } else {
                item.selected = state;
            }
        } else {
            setItemSelection(item, state);
        }
        this.setSelectedItems();
    }
    onMouseDrag (event) {
        const point = event.point;
        const actionBounds = getActionBounds(this.mode in BitmapModes);

        point.x = Math.max(actionBounds.left, Math.min(point.x, actionBounds.right));
        point.y = Math.max(actionBounds.top, Math.min(point.y, actionBounds.bottom));

        const dragVector = point.subtract(event.downPoint);
        let snapVector;

        // Paint-snap: snap selection center to page/object guides.
        // Shift always disables snap (angle snap, as in upstream); Ctrl also
        // disables it when the "Hold Ctrl to disable snap" option is on.
        // Not in reshape mode, because reshape doesn't show center crosshair.
        // Settings menu toggles are stored in localStorage by the app shell.
        const snapSettings = loadSnapSettings();
        // Paper.js exposes this as `control` (see arrow-tool.js), not `ctrl`.
        const nativeEvent = event.event || {};
        const ctrlDisablesSnap = snapSettings.snapCtrlDisable &&
            (event.modifiers.control || event.modifiers.meta ||
                nativeEvent.ctrlKey || nativeEvent.metaKey);
        this._removeSnapGuides();

        // Leaving the curve: once a text has been snapped to a path, dragging
        // far away or pressing Ctrl/Meta must release it. Without this the
        // text would stay glued to the curve for the rest of the drag.
        let pathDistance = Infinity;
        if (this._pathText && this._pathText.path &&
                this._pathText.path.getNearestLocation) {
            const nearest = this._pathText.path.getNearestLocation(point);
            if (nearest) pathDistance = nearest.getPoint().getDistance(point);
        }
        const cancelPathText = event.modifiers.control || event.modifiers.meta ||
            (nativeEvent && (nativeEvent.ctrlKey || nativeEvent.metaKey));
        if (this._pathText && (cancelPathText ||
                pathDistance > PATH_TEXT_DETACH_THRESHOLD / paper.view.zoom)) {
            this._detachPathText(point, dragVector, pathDistance);
        }

        // After detaching, wait until the pointer has moved clearly away from
        // the old curve before arming snapping again. This prevents an
        // immediate re-snap after a Ctrl-release while still on the line,
        // while still allowing a deliberate re-approach later in the drag.
        if (!this._pathText && !this._pathTextArmed && this._pathTextDetachedPath &&
                this._pathTextDetachedPath.getNearestLocation) {
            const nearest = this._pathTextDetachedPath.getNearestLocation(point);
            if (nearest && nearest.getPoint().getDistance(point) >
                    PATH_TEXT_REARM_THRESHOLD / paper.view.zoom) {
                this._pathTextArmed = true;
                this._pathTextDetachedPath = null;
            }
        }

        // Path text is an opt-in extension of the existing snap feature. It
        // uses the mouse position to find a nearby stroked path, then lays the
        // selected text out one glyph at a time along that path.
        let pathTextHandled = false;
        // The bounding-box helper is kept in selectedItems while dragging.
        // Look only at the actual selected content for path text.
        const contentItems = (this.selectedItems || []).filter(item =>
            item !== this.boundsPath && !(item.data && item.data.isHelperItem));
        const selectedText = contentItems.length === 1 && contentItems[0] instanceof paper.PointText ?
            contentItems[0] : null;
        const canPathText = snapSettings.snap && snapSettings.snapTextToPath &&
            !ctrlDisablesSnap && this._pathTextArmed && !event.modifiers.shift &&
            this.mode !== Modes.RESHAPE && selectedText;
        if (canPathText || this._pathText) {
            let pathTarget = findPathTextTarget(
                point,
                contentItems,
                PATH_TEXT_THRESHOLD / paper.view.zoom
            );
            // Once path text is active, keep following the current path even
            // when the pointer drifts slightly off the line. The nearest
            // location still gives a stable, continuous start point.
            if (!pathTarget && this._pathText && this._pathText.path &&
                    this._pathText.path.getNearestLocation) {
                const location = this._pathText.path.getNearestLocation(point);
                if (location) {
                    pathTarget = {
                        path: this._pathText.path,
                        offset: location.getOffset(),
                        point: location.getPoint(),
                        distance: location.getPoint().getDistance(point)
                    };
                }
            }
            if (pathTarget || this._pathText) {
                if (!this._pathText) {
                    // Keep a detached copy of the original text so leaving the
                    // curve can restore the normal editable text.
                    const original = selectedText.clone({insert: false});
                    original.matrix = selectedText.matrix.clone();
                    const originalCenter = selectedText.position.clone();
                    const conversionPoint = point.clone();
                    const group = createPathText(selectedText);
                    if (group) {
                        this._pathText = {
                            group,
                            original,
                            originalMatrix: original.matrix.clone(),
                            originalCenter,
                            conversionPoint
                        };
                        this.selectedItems = [group];
                        this._selectionBounds = group.bounds;
                        this.selectionCenter = group.bounds.center;
                        setItemSelection(group, true);
                        this.setSelectedItems();
                    }
                }
                if (this._pathText) {
                    if (pathTarget) {
                        this._pathText.path = pathTarget.path;
                        this._pathText.offset = pathTarget.offset;
                    }
                    if (this._pathText.path) {
                        const offset = pathTarget ? pathTarget.offset : (this._pathText.offset || 0);
                        layoutPathText(this._pathText.group, this._pathText.path, offset);
                        this._selectionBounds = this._pathText.group.bounds;
                        this.selectionCenter = this._selectionBounds.center;
                        if (pathTarget) this._showPathTextGuide(pathTarget.path, pathTarget.point);
                    }
                    pathTextHandled = true;
                }
            }
        }

        if (!pathTextHandled && snapSettings.snap && !ctrlDisablesSnap && !event.modifiers.shift && this.mode !== Modes.RESHAPE && this.selectionCenter) {
            const scaledThreshold = SNAP_THRESHOLD / paper.view.zoom;
            const selectionBounds = this._selectionBounds || (() => {
                let b = null;
                for (const item of this.selectedItems) {
                    b = b ? b.unite(item.bounds) : item.bounds;
                }
                return b;
            })();
            if (selectionBounds) {
                const paintLayerChildren = paper.project.getItem({data: {isPaintingLayer: true}}) ?
                    paper.project.getItem({data: {isPaintingLayer: true}}).children : [];
                const {from, to} = createSnapPoints(selectionBounds, paintLayerChildren, snapSettings);
                const configDefFn = pointDef => {
                    if (!pointDef.clamp) pointDef.clamp = {min: -Infinity, max: Infinity};
                    if (pointDef.type === 'point') return () => pointDef.value;
                    if (pointDef.type === 'xcoord' || pointDef.type === 'itemSideVert') {
                        return p => new paper.Point(pointDef.value, Math.min(Math.max(p.y, pointDef.clamp.min), pointDef.clamp.max));
                    }
                    if (pointDef.type === 'ycoord' || pointDef.type === 'itemSideHoriz') {
                        return p => new paper.Point(Math.min(Math.max(p.x, pointDef.clamp.min), pointDef.clamp.max), pointDef.value);
                    }
                    return () => pointDef.value;
                };
                const priority = ['point', 'itemSideVert', 'itemSideHoriz', 'xcoord', 'ycoord', undefined];
                const sortByPrioOrDist = (a, b) => {
                    const prioDiff = priority.indexOf(a.snapPointType) - priority.indexOf(b.snapPointType);
                    return prioDiff || (a.distance - b.distance);
                };
                let best = null;
                for (const point of Object.values(from)) {
                    const moved = point.add(dragVector);
                    for (const [pos, def] of Object.entries(to)) {
                        const snapPoint = configDefFn(def)(moved);
                        if (checkPointsClose(moved, snapPoint, scaledThreshold)) {
                            const candidate = {
                                point, snapPoint, snapPointType: def.type,
                                distance: moved.getDistance(snapPoint), pos
                            };
                            if (!best || sortByPrioOrDist(candidate, best) < 0) best = candidate;
                        }
                    }
                }
                if (best && best.snapPoint) {
                    snapVector = best.snapPoint.subtract(best.point);
                    this._showSnapGuides(best, actionBounds);
                }
            }
        }
        if (this.selectedItems.length === 0) {
            return;
        }

        let bounds;
        if (pathTextHandled && this._pathText) {
            // Path text glyphs already have absolute positions. Do not apply
            // the generic drag translation to their group.
            bounds = this._pathText.group.bounds;
        } else {
            for (const item of this.selectedItems) {
                // add the position of the item before the drag started
                // for later use in the snap calculation
                if (!item.data.origPos) {
                    item.data.origPos = item.position;
                }

                if (snapVector) {
                    item.position = item.data.origPos.add(snapVector);
                } else if (event.modifiers.shift) {
                    item.position = item.data.origPos.add(snapDeltaToAngle(dragVector, Math.PI / 4));
                } else {
                    item.position = item.data.origPos.add(dragVector);
                }

                if (bounds) {
                    bounds = bounds.unite(item.bounds);
                } else {
                    bounds = item.bounds;
                }
            }
        }

        if (this.firstDrag) {
            // Show the center crosshair above the selected item while dragging.
            getDragCrosshairLayer().visible = true;
            this.firstDrag = false;
        }

        // The rotation center crosshair should be opaque over the entire selection bounding box, and fade out to
        // totally transparent outside the selection bounding box.
        let opacityMultiplier = 1;
        const newCenter = this.selectionCenter.add(dragVector);
        if ((CENTER.y < bounds.top && CENTER.x < bounds.left) ||
            (CENTER.y > bounds.bottom && CENTER.x < bounds.left) ||
            (CENTER.y < bounds.top && CENTER.x > bounds.right) ||
            (CENTER.y > bounds.bottom && CENTER.x > bounds.right)) {

            // rotation center is to one of the 4 corners of the selection bounding box
            const distX = Math.max(CENTER.x - bounds.right, bounds.left - CENTER.x);
            const distY = Math.max(CENTER.y - bounds.bottom, bounds.top - CENTER.y);
            const dist = Math.sqrt((distX * distX) + (distY * distY));
            opacityMultiplier =
                Math.max(0, (1 - (dist / (FADE_DISTANCE / paper.view.zoom))));
        } else if (CENTER.y < bounds.top || CENTER.y > bounds.bottom) {
            // rotation center is above or below the selection bounding box
            opacityMultiplier = Math.max(0,
                (1 - ((Math.abs(CENTER.y - newCenter.y) - (bounds.height / 2)) / (FADE_DISTANCE / paper.view.zoom))));
        } else if (CENTER.x < bounds.left || CENTER.x > bounds.right) {
            // rotation center is left or right of the selection bounding box
            opacityMultiplier = Math.max(0,
                (1 - ((Math.abs(CENTER.x - newCenter.x) - (bounds.width / 2)) / (FADE_DISTANCE / paper.view.zoom))));
        } // else the rotation center is within selection bounds, always show drag crosshair at full opacity
        getDragCrosshairLayer().opacity = CROSSHAIR_FULL_OPACITY * opacityMultiplier;
    }
    _detachPathText (point, dragVector, pathDistance) {
        const pathText = this._pathText;
        if (!pathText) return;
        this._pathText = null;
        this._pathTextDetachedPath = pathText.path || null;
        // A far drag has already left the re-arm zone; a Ctrl detach near the
        // line waits until the pointer moves away.
        this._pathTextArmed = pathDistance >
            PATH_TEXT_REARM_THRESHOLD / paper.view.zoom;

        const {group, original, originalMatrix, originalCenter, conversionPoint} = pathText;
        const parent = group && group.parent;
        const index = group && group.index;
        if (group) {
            if (group.selected) setItemSelection(group, false);
            group.remove();
        }
        if (!original) return;

        // Restore the normal PointText and put it where the pointer would have
        // carried it since the moment it snapped to the curve.
        original.matrix = originalMatrix.clone();
        original.position = originalCenter.add(point.subtract(conversionPoint));
        if (!original.data) original.data = {};
        original.data.origPos = original.position.subtract(dragVector);
        if (parent) parent.insertChild(index, original);
        setItemSelection(original, true);
        this.selectedItems = [original];
        this._selectionBounds = original.bounds;
        this.selectionCenter = this._selectionBounds.center;
        this.setSelectedItems();
    }
    _removeSnapGuides () {
        if (this._snapGuideLine) {
            this._snapGuideLine.remove();
            this._snapGuideLine = null;
        }
        if (this._snapGuidePoint) {
            this._snapGuidePoint.remove();
            this._snapGuidePoint = null;
        }
        if (this._pathTextGuide) {
            this._pathTextGuide.remove();
            this._pathTextGuide = null;
        }
        if (this._pathTextGuidePoint) {
            this._pathTextGuidePoint.remove();
            this._pathTextGuidePoint = null;
        }
    }
    _showPathTextGuide (path, point) {
        const guideLayer = getGuideLayer();
        if (!guideLayer) return;
        const guidePath = path.clone(false);
        if (!guidePath) return;
        guidePath.guide = true;
        guidePath.data = {isHelperItem: true};
        guidePath.fillColor = null;
        guidePath.strokeColor = new paper.Color(SNAP_GUIDE_COLOR);
        guidePath.strokeWidth = 1 / paper.view.zoom;
        guidePath.dashArray = [4 / paper.view.zoom, 3 / paper.view.zoom];
        guideLayer.addChild(guidePath);
        const guidePoint = new paper.Path.Circle({
            center: point,
            radius: 4 / paper.view.zoom,
            fillColor: new paper.Color(SNAP_GUIDE_COLOR),
            guide: true,
            data: {isHelperItem: true}
        });
        guideLayer.addChild(guidePoint);
        this._pathTextGuide = guidePath;
        this._pathTextGuidePoint = guidePoint;
    }
    _showSnapGuides (best, actionBounds) {
        this._removeSnapGuides();
        const guideLayer = getGuideLayer();
        if (!guideLayer) return;
        if (best.snapPointType === 'point') {
            const group = new paper.Group({visible: true});
            const shadow = new paper.Path.Circle({
                center: new paper.Point(0, 0),
                radius: 5.5 / paper.view.zoom,
                fillColor: 'black',
                opacity: 0.12,
                guide: true,
                data: {isHelperItem: true}
            });
            const circle = new paper.Path.Circle({
                center: new paper.Point(0, 0),
                radius: 4 / paper.view.zoom,
                fillColor: new paper.Color(SNAP_GUIDE_COLOR),
                guide: true,
                data: {isHelperItem: true}
            });
            group.addChildren([shadow, circle]);
            group.position = best.snapPoint;
            guideLayer.addChild(group);
            this._snapGuidePoint = group;
        } else if (best.snapPointType === 'xcoord' || best.snapPointType === 'itemSideVert') {
            const line = new paper.Path.Line({
                from: new paper.Point(best.snapPoint.x, actionBounds.top),
                to: new paper.Point(best.snapPoint.x, actionBounds.bottom),
                strokeColor: new paper.Color(SNAP_GUIDE_COLOR),
                strokeWidth: 1 / paper.view.zoom,
                guide: true,
                data: {isHelperItem: true}
            });
            guideLayer.addChild(line);
            this._snapGuideLine = line;
        } else if (best.snapPointType === 'ycoord' || best.snapPointType === 'itemSideHoriz') {
            const line = new paper.Path.Line({
                from: new paper.Point(actionBounds.left, best.snapPoint.y),
                to: new paper.Point(actionBounds.right, best.snapPoint.y),
                strokeColor: new paper.Color(SNAP_GUIDE_COLOR),
                strokeWidth: 1 / paper.view.zoom,
                guide: true,
                data: {isHelperItem: true}
            });
            guideLayer.addChild(line);
            this._snapGuideLine = line;
        }
    }
    onMouseUp () {
        this._removeSnapGuides();
        this._selectionBounds = null;
        this.firstDrag = false;
        const pathTextChanged = Boolean(this._pathText);
        this._pathText = null;
        this._pathTextArmed = true;
        this._pathTextDetachedPath = null;
        let moved = false;
        // resetting the items origin point for the next usage
        for (const item of this.selectedItems) {
            if (item.data.origPos) {
                if (!item.position.equals(item.data.origPos)) moved = true;
                delete item.data.origPos;
            }
        }
        this.selectedItems = null;
        this.selectionCenter = null;

        if (moved || pathTextChanged) {
            this.onUpdateImage();
        }

        // Hide the crosshair we showed earlier.
        getDragCrosshairLayer().visible = false;
    }
}

export default MoveTool;
