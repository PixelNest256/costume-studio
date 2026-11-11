import paper from '@scratch/paper';

import {getGuideLayer} from '../layer';
import {getRepeatedStageBounds, getStageBounds} from '../view';
import {SNAP_GUIDE_COLOR, SNAP_THRESHOLD, loadSnapSettings} from '../snap-settings';

const EPSILON = 1e-7;
const PRIORITY = {
    width: 0,
    height: 0,
    xcoord: 1,
    ycoord: 1
};

const isUsableTarget = item => (
    item &&
    !item.selected &&
    !(item.data && (item.data.isHelperItem || item.locked || item.guide))
);

/**
 * Bind a size snap to the same modifier behavior as the move tool.
 * @param {object} event Paper.js mouse event
 * @returns {?object} snap settings, or null when snapping is disabled
 */
export const getScaleSnapSettings = event => {
    const settings = loadSnapSettings();
    if (!settings.snap) return null;
    if (settings.snapCtrlDisable) {
        const nativeEvent = event.event || {};
        const ctrl = (event.modifiers && (event.modifiers.control || event.modifiers.meta)) ||
            nativeEvent.ctrlKey || nativeEvent.metaKey;
        if (ctrl) return null;
    }
    return settings;
};

/**
 * Build the targets used while dragging a scale handle. Width/height targets
 * are what make a selection snap to the stage or another object's size.
 */
export const createScaleSnapTargets = (objects, settings) => {
    const targets = [];
    const stage = getStageBounds();
    const stageBoundsList = getRepeatedStageBounds();

    for (let i = 0; i < stageBoundsList.length; i++) {
        const stageBounds = stageBoundsList[i];
        if (settings.snapPageAxes) {
            targets.push({type: 'xcoord', value: stageBounds.center.x});
            targets.push({type: 'ycoord', value: stageBounds.center.y});
        }
        if (settings.snapPageEdges) {
            targets.push({type: 'xcoord', value: stageBounds.left});
            targets.push({type: 'xcoord', value: stageBounds.right});
            targets.push({type: 'ycoord', value: stageBounds.top});
            targets.push({type: 'ycoord', value: stageBounds.bottom});
        }
    }

    if (settings.snapPageEdges) {
        targets.push({
            type: 'width',
            x1: stage.left,
            x2: stage.right,
            guideY: stage.center.y,
            size: stage.width
        });
        targets.push({
            type: 'height',
            y1: stage.top,
            y2: stage.bottom,
            guideX: stage.center.x,
            size: stage.height
        });
    }

    for (const item of objects) {
        if (!isUsableTarget(item)) continue;
        const bounds = item.bounds;
        if (settings.snapObjectEdges) {
            targets.push({type: 'xcoord', value: bounds.left});
            targets.push({type: 'xcoord', value: bounds.right});
            targets.push({type: 'ycoord', value: bounds.top});
            targets.push({type: 'ycoord', value: bounds.bottom});
            if (bounds.width > EPSILON) {
                targets.push({
                    type: 'width',
                    x1: bounds.left,
                    x2: bounds.right,
                    guideY: bounds.bottom,
                    size: bounds.width
                });
            }
            if (bounds.height > EPSILON) {
                targets.push({
                    type: 'height',
                    y1: bounds.top,
                    y2: bounds.bottom,
                    guideX: bounds.left,
                    size: bounds.height
                });
            }
        }
        if (settings.snapObjectMidlines) {
            targets.push({type: 'xcoord', value: bounds.center.x});
            targets.push({type: 'ycoord', value: bounds.center.y});
        }
    }

    return targets;
};

const candidateSort = (a, b) => {
    const priority = PRIORITY[a.target.type] - PRIORITY[b.target.type];
    return priority || (a.distance - b.distance);
};

const xScaleFor = (target, state) => {
    if (target.type === 'width') {
        return (state.origSize.x < 0 ? -1 : 1) * target.size / Math.abs(state.origSize.x);
    }
    return ((target.value - state.pivot.x) / state.origSize.x) * (state.alt ? 2 : 1);
};

const yScaleFor = (target, state) => {
    if (target.type === 'height') {
        return (state.origSize.y < 0 ? -1 : 1) * target.size / Math.abs(state.origSize.y);
    }
    return ((target.value - state.pivot.y) / state.origSize.y) * (state.alt ? 2 : 1);
};

/**
 * Pick the closest width/height or coordinate snap for each axis.
 * @param {object} state Drag state from ScaleTool
 * @returns {{sx: number, sy: number, x: ?object, y: ?object}}
 */
export const getScaleSnapAdjustment = state => {
    const threshold = state.threshold || (SNAP_THRESHOLD / paper.view.zoom);
    const canX = state.isCorner || Math.abs(state.origSize.x) > EPSILON;
    const canY = state.isCorner || Math.abs(state.origSize.y) > EPSILON;
    const xCandidates = [];
    const yCandidates = [];

    for (const target of state.targets) {
        if (target.type === 'width') {
            if (!canX || Math.abs(state.origSize.x) < EPSILON) continue;
            const distance = Math.abs(state.width - target.size);
            if (distance <= threshold) {
                xCandidates.push({target, distance, scale: xScaleFor(target, state)});
            }
        } else if (target.type === 'height') {
            if (!canY || Math.abs(state.origSize.y) < EPSILON) continue;
            const distance = Math.abs(state.height - target.size);
            if (distance <= threshold) {
                yCandidates.push({target, distance, scale: yScaleFor(target, state)});
            }
        } else if (target.type === 'xcoord') {
            if (!canX || Math.abs(state.origSize.x) < EPSILON) continue;
            const distance = Math.abs(state.corner.x - target.value);
            if (distance <= threshold) {
                xCandidates.push({target, distance, scale: xScaleFor(target, state)});
            }
        } else if (target.type === 'ycoord') {
            if (!canY || Math.abs(state.origSize.y) < EPSILON) continue;
            const distance = Math.abs(state.corner.y - target.value);
            if (distance <= threshold) {
                yCandidates.push({target, distance, scale: yScaleFor(target, state)});
            }
        }
    }

    xCandidates.sort(candidateSort);
    yCandidates.sort(candidateSort);
    const x = xCandidates[0] || null;
    const y = yCandidates[0] || null;
    return {
        sx: x ? x.scale : state.sx,
        sy: y ? y.scale : state.sy,
        x,
        y
    };
};

/**
 * Draw the add-on style dimension/axis guides while a scale snap is active.
 */
export class ScaleSnapGuides {
    constructor () {
        this.group = null;
    }

    clear () {
        if (this.group) {
            this.group.remove();
            this.group = null;
        }
    }

    _line (from, to) {
        return new paper.Path.Line({
            from,
            to,
            strokeColor: new paper.Color(SNAP_GUIDE_COLOR),
            strokeWidth: 1 / paper.view.zoom,
            guide: true,
            data: {isHelperItem: true, noSelect: true, noHover: true}
        });
    }

    _ensureGroup () {
        if (!this.group) {
            this.group = new paper.Group({
                guide: true,
                data: {isHelperItem: true, noSelect: true, noHover: true}
            });
            getGuideLayer().addChild(this.group);
        }
        return this.group;
    }

    _widthGuide (selectionBounds, target) {
        const zoom = paper.view.zoom;
        const group = this._ensureGroup();
        const tick = 4 / zoom;
        const targetY = target.guideY;
        const selectionY = selectionBounds.bottom + (5 / zoom);
        group.addChild(this._line(
            new paper.Point(target.x1, targetY),
            new paper.Point(target.x2, targetY)
        ));
        group.addChild(this._line(
            new paper.Point(target.x1, targetY),
            new paper.Point(target.x1, targetY + tick)
        ));
        group.addChild(this._line(
            new paper.Point(target.x2, targetY),
            new paper.Point(target.x2, targetY + tick)
        ));
        group.addChild(this._line(
            new paper.Point(selectionBounds.left, selectionY),
            new paper.Point(selectionBounds.right, selectionY)
        ));
        group.addChild(this._line(
            new paper.Point(selectionBounds.left, selectionY),
            new paper.Point(selectionBounds.left, selectionY + tick)
        ));
        group.addChild(this._line(
            new paper.Point(selectionBounds.right, selectionY),
            new paper.Point(selectionBounds.right, selectionY + tick)
        ));
    }

    _heightGuide (selectionBounds, target) {
        const zoom = paper.view.zoom;
        const group = this._ensureGroup();
        const tick = 4 / zoom;
        const targetX = target.guideX;
        const selectionX = selectionBounds.left - (5 / zoom);
        group.addChild(this._line(
            new paper.Point(targetX, target.y1),
            new paper.Point(targetX, target.y2)
        ));
        group.addChild(this._line(
            new paper.Point(targetX, target.y1),
            new paper.Point(targetX - tick, target.y1)
        ));
        group.addChild(this._line(
            new paper.Point(targetX, target.y2),
            new paper.Point(targetX - tick, target.y2)
        ));
        group.addChild(this._line(
            new paper.Point(selectionX, selectionBounds.top),
            new paper.Point(selectionX, selectionBounds.bottom)
        ));
        group.addChild(this._line(
            new paper.Point(selectionX, selectionBounds.top),
            new paper.Point(selectionX - tick, selectionBounds.top)
        ));
        group.addChild(this._line(
            new paper.Point(selectionX, selectionBounds.bottom),
            new paper.Point(selectionX - tick, selectionBounds.bottom)
        ));
    }

    _axisXGuide (target, actionBounds) {
        const group = this._ensureGroup();
        group.addChild(this._line(
            new paper.Point(target.value, actionBounds.top),
            new paper.Point(target.value, actionBounds.bottom)
        ));
    }

    _axisYGuide (target, actionBounds) {
        const group = this._ensureGroup();
        group.addChild(this._line(
            new paper.Point(actionBounds.left, target.value),
            new paper.Point(actionBounds.right, target.value)
        ));
    }

    show (x, y, selectionBounds, actionBounds) {
        this.clear();
        if (x) {
            if (x.target.type === 'width') {
                this._widthGuide(selectionBounds, x.target);
            } else {
                this._axisXGuide(x.target, actionBounds);
            }
        }
        if (y) {
            if (y.target.type === 'height') {
                this._heightGuide(selectionBounds, y.target);
            } else {
                this._axisYGuide(y.target, actionBounds);
            }
        }
    }
}
