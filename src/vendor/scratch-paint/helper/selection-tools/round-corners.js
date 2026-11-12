import paper from '@scratch/paper';

import {getGuideLayer} from '../layer.js';
import {getSelectedLeafItems} from '../selection.js';

const EPSILON = 0.5;
const MIN_HANDLE_DISTANCE = 18;
const HANDLE_RADIUS = 4;
const HANDLE_HALO_RADIUS = 6;
const HANDLE_HIT_RADIUS = 9;
const HANDLE_COLOR = '#009dec';

const isSharp = segment => (
    segment.handleIn.length < EPSILON &&
    segment.handleOut.length < EPSILON
);

const restorePath = (path, snapshot) => {
    while (path.segments.length > snapshot.length) {
        path.removeSegment(path.segments.length - 1);
    }
    while (path.segments.length < snapshot.length) {
        path.add(new paper.Segment());
    }
    for (let i = 0; i < snapshot.length; i++) {
        const segment = path.segments[i];
        const saved = snapshot[i];
        segment.point = new paper.Point(saved.x, saved.y);
        segment.handleIn = new paper.Point(saved.hix, saved.hiy);
        segment.handleOut = new paper.Point(saved.hox, saved.hoy);
        segment.selected = saved.selected;
    }
};

const snapshotPath = path => path.segments.map(segment => ({
    x: segment.point.x,
    y: segment.point.y,
    hix: segment.handleIn.x,
    hiy: segment.handleIn.y,
    hox: segment.handleOut.x,
    hoy: segment.handleOut.y,
    selected: segment.selected
}));

const isEditablePath = item => (
    item &&
    item.layer &&
    item.layer.data &&
    item.layer.data.isPaintingLayer &&
    item.className === 'Path' &&
    !(item.data && (item.data.isHelperItem || item.data.isRoundCornerHandle))
);

const getPathList = item => {
    if (item && item.className === 'CompoundPath') {
        return item.children.filter(isEditablePath);
    }
    return isEditablePath(item) ? [item] : [];
};

const makeHandle = (path, index) => {
    const segments = path.segments;
    const count = segments.length;
    const segment = segments[index];
    if (!isSharp(segment)) return null;

    const previous = segments[(index - 1 + count) % count];
    const next = segments[(index + 1) % count];
    const corner = path.localToGlobal(segment.point);
    const previousPoint = path.localToGlobal(previous.point);
    const nextPoint = path.localToGlobal(next.point);
    const previousVector = previousPoint.subtract(corner);
    const nextVector = nextPoint.subtract(corner);
    if (previousVector.length < EPSILON || nextVector.length < EPSILON) return null;

    const previousUnit = previousVector.normalize();
    const nextUnit = nextVector.normalize();
    const dot = Math.max(-1, Math.min(1, previousUnit.dot(nextUnit)));
    // A path that folds back on itself or continues straight through this
    // point has no meaningful corner to round.
    if (dot > 0.98 || dot < -0.98) return null;

    const angle = Math.acos(dot);
    const sinHalfAngle = Math.sin(angle / 2);
    const tanHalfAngle = Math.tan(angle / 2);
    if (sinHalfAngle < 1e-6 || tanHalfAngle < 1e-6) return null;

    const maxRadius = Math.min(previousVector.length, nextVector.length) * tanHalfAngle;
    if (!Number.isFinite(maxRadius) || maxRadius < 0.1) return null;

    return {
        path,
        segIndex: index,
        corner,
        previousUnit,
        nextUnit,
        bisector: previousUnit.add(nextUnit).normalize(),
        sinHalfAngle,
        tanHalfAngle,
        maxRadius,
        radius: 0,
        widget: null
    };
};

const handleLength = (radius, angle) => (
    radius * (4 / 3) * Math.tan(((Math.PI - angle) / 2) / 2)
);

/**
 * Passive corner-rounding widgets for Reshape mode. They are guides, not part
 * of the artwork, so they never appear in exports or undo snapshots.
 */
export default class RoundCornersOverlay {
    constructor (onUpdateImage) {
        this.onUpdateImage = onUpdateImage;
        this.group = null;
        this.handles = [];
        this.signature = '';
        this.drag = null;
    }

    clear () {
        if (this.group) {
            this.group.remove();
            this.group = null;
        }
        this.handles = [];
        this.signature = '';
        this.drag = null;
    }

    _paths () {
        const paths = [];
        const seen = new Set();
        for (const item of getSelectedLeafItems()) {
            for (const path of getPathList(item)) {
                if (!seen.has(path.id) && path.segments.length >= 3) {
                    seen.add(path.id);
                    paths.push(path);
                }
            }
        }
        return paths;
    }

    _signature (paths) {
        const parts = [`${paper.view.zoom}`];
        for (const path of paths) {
            parts.push(path.id);
            for (const segment of path.segments) {
                parts.push(
                    `${segment.point.x.toFixed(2)},${segment.point.y.toFixed(2)},` +
                    `${segment.selected ? 1 : 0}`
                );
            }
        }
        return parts.join('|');
    }

    _buildHandles (paths) {
        const handles = [];
        for (const path of paths) {
            const segments = path.segments;
            const count = segments.length;
            const closed = path.closed;
            const anySelected = segments.some(segment => segment.selected);
            const all = [];
            const selected = [];
            const start = closed ? 0 : 1;
            const end = closed ? count : count - 1;
            for (let index = start; index < end; index++) {
                const handle = makeHandle(path, index);
                if (!handle) continue;
                all.push(handle);
                if (segments[index].selected) selected.push(handle);
            }
            // With no selected points, make every corner available. When the
            // user has selected points, prefer just those corners, but fall
            // back to all corners if the selected points are not roundable.
            if (anySelected && selected.length > 0) {
                handles.push(...selected);
            } else {
                handles.push(...all);
            }
        }
        return handles;
    }

    _widgetPosition (handle) {
        const zoom = paper.view.zoom;
        const minimum = Math.min(
            MIN_HANDLE_DISTANCE / zoom,
            handle.maxRadius / Math.max(handle.sinHalfAngle, 1e-6)
        );
        const distance = Math.max(
            minimum,
            handle.radius / Math.max(handle.sinHalfAngle, 1e-6)
        );
        return handle.corner.add(handle.bisector.multiply(distance));
    }

    _makeWidget (handle) {
        const guideLayer = getGuideLayer();
        if (!guideLayer) return;
        const zoom = paper.view.zoom;
        const position = this._widgetPosition(handle);
        const halo = new paper.Path.Circle({
            center: position,
            radius: HANDLE_HALO_RADIUS / zoom,
            fillColor: 'rgba(0,0,0,0.12)',
            guide: true,
            data: {isHelperItem: true, isRoundCornerHandle: true}
        });
        const dot = new paper.Path.Circle({
            center: position,
            radius: HANDLE_RADIUS / zoom,
            fillColor: HANDLE_COLOR,
            guide: true,
            data: {isHelperItem: true, isRoundCornerHandle: true}
        });
        handle.widget = new paper.Group([halo, dot]);
        handle.widget.guide = true;
        handle.widget.data = {isHelperItem: true, isRoundCornerHandle: true};
        this.group.addChild(handle.widget);
    }

    _updateWidgets () {
        for (const handle of this.handles) {
            if (handle.widget) {
                handle.widget.position = this._widgetPosition(handle);
            }
        }
    }

    refresh (force = false) {
        if (this.drag) return;
        const paths = this._paths();
        const signature = this._signature(paths);
        if (!force && signature === this.signature) return;
        this.signature = signature;
        if (this.group) {
            this.group.remove();
            this.group = null;
        }
        this.handles = this._buildHandles(paths);
        if (!this.handles.length) return;

        this.group = new paper.Group({
            guide: true,
            data: {isHelperItem: true, isRoundCornerHandle: true}
        });
        getGuideLayer().addChild(this.group);
        for (const handle of this.handles) {
            this._makeWidget(handle);
        }
        this.group.bringToFront();
    }

    hitTest (point, extraRadius = 0) {
        const threshold = (HANDLE_HIT_RADIUS + extraRadius) / paper.view.zoom;
        let best = null;
        for (const handle of this.handles) {
            const distance = this._widgetPosition(handle).getDistance(point);
            if (distance <= threshold && (!best || distance < best.distance)) {
                best = {handle, distance};
            }
        }
        return best ? best.handle : null;
    }

    startDrag (handle, event, onlyThis = false) {
        const targets = onlyThis ? [handle] : this.handles.slice();
        this.drag = {
            handle,
            startRadius: handle.radius,
            startProjection: event.point.subtract(handle.corner).dot(handle.bisector),
            targets,
            snapshots: new Map(),
            changed: false
        };
        for (const target of this.drag.targets) {
            if (!this.drag.snapshots.has(target.path)) {
                this.drag.snapshots.set(target.path, snapshotPath(target.path));
            }
        }
    }

    _applyCorner (handle) {
        if (handle.radius < 0.1) return;
        const path = handle.path;
        const segments = path.segments;
        const segment = segments[handle.segIndex];
        if (!segment) return;

        const selected = segment.selected;
        // maxRadius already keeps the tangent points on the adjacent edges.
        const tangentDistance = handle.radius / handle.tanHalfAngle;
        const p1 = handle.corner.add(handle.previousUnit.multiply(tangentDistance));
        const p2 = handle.corner.add(handle.nextUnit.multiply(tangentDistance));
        const length = handleLength(handle.radius, Math.acos(Math.max(-1,
            Math.min(1, handle.previousUnit.dot(handle.nextUnit)))));
        const p1Local = path.globalToLocal(p1);
        const p2Local = path.globalToLocal(p2);
        const handleOut = path.globalToLocal(
            p1.add(handle.previousUnit.multiply(-length))
        ).subtract(p1Local);
        const handleIn = path.globalToLocal(
            p2.add(handle.nextUnit.multiply(-length))
        ).subtract(p2Local);

        path.insertSegments(handle.segIndex + 1, [
            new paper.Segment(p2Local, handleIn, new paper.Point(0, 0))
        ]);
        path.segments[handle.segIndex + 1].selected = selected;
        segment.point = p1Local;
        segment.handleIn = new paper.Point(0, 0);
        segment.handleOut = handleOut;
        segment.selected = selected;
    }

    _applyAll () {
        const drag = this.drag;
        if (!drag) return;
        for (const [path, snapshot] of drag.snapshots) {
            restorePath(path, snapshot);
        }
        const targets = drag.targets.slice().sort((a, b) => b.segIndex - a.segIndex);
        for (const handle of targets) {
            this._applyCorner(handle);
        }
        this._updateWidgets();
    }

    dragTo (point) {
        const drag = this.drag;
        if (!drag) return;
        const handle = drag.handle;
        const projection = point.subtract(handle.corner).dot(handle.bisector);
        const requested = Math.max(
            0,
            drag.startRadius + ((projection - drag.startProjection) * handle.sinHalfAngle)
        );
        for (const target of drag.targets) {
            target.radius = Math.min(requested, target.maxRadius);
        }
        drag.changed = drag.changed || requested > 0.1;
        this._applyAll();
    }

    endDrag () {
        const changed = this.drag && this.drag.changed;
        this.drag = null;
        if (changed) this.onUpdateImage();
        this.refresh(true);
    }
}
