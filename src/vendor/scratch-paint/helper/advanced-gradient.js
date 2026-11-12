import paper from '@scratch/paper';

import {getSelectedLeafItems} from './selection.js';
import {generateSecondaryColor} from './style-path.js';

const DEFAULT_COLOR = '#9966ff';
const MIN_STOPS = 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const colorToCss = (color, opacity) => {
    const hex = String(color || DEFAULT_COLOR).replace('#', '');
    const value = hex.length === 3 ? hex.split('').map(part => part + part).join('') : hex;
    const match = /^([0-9a-f]{6})$/i.exec(value);
    if (!match) return `rgba(153,102,255,${opacity})`;
    const number = parseInt(match[1], 16);
    return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${clamp(opacity, 0, 1)})`;
};

const rgbToHex = color => {
    if (!color) return DEFAULT_COLOR;
    return color.toCSS(true /* hex */);
};

const getColorProp = isStroke => (isStroke ? 'strokeColor' : 'fillColor');

const getTargets = isStroke => {
    const targets = [];
    const seen = new Set();
    for (let item of getSelectedLeafItems()) {
        if (item.parent instanceof paper.CompoundPath) item = item.parent;
        if (!item || !item.bounds || seen.has(item.id)) continue;
        seen.add(item.id);
        targets.push(item);
    }
    return targets;
};

const getFirstGradient = (targets, isStroke) => {
    const prop = getColorProp(isStroke);
    for (const item of targets) {
        const color = item[prop];
        if (color && color.gradient) return {item, color};
    }
    return null;
};

export const readGradient = isStroke => {
    const targets = getTargets(isStroke);
    if (!targets.length) return null;

    const prop = getColorProp(isStroke);
    const first = getFirstGradient(targets, isStroke);
    const fallback = targets[0][prop];
    const gradient = first && first.color.gradient;
    let stops;

    if (gradient && gradient.stops.length >= MIN_STOPS) {
        const count = gradient.stops.length;
        stops = gradient.stops.map((stop, index) => ({
            id: `stop-${index}-${Math.random().toString(36).slice(2, 7)}`,
            offset: stop.offset === undefined || stop.offset === null ? index / (count - 1) : stop.offset,
            color: rgbToHex(stop.color),
            opacity: stop.color ? stop.color.alpha : 1
        }));
    } else {
        const primary = fallback ?
            (fallback.alpha === 0 ? null : fallback.toCSS(true /* hex */)) :
            DEFAULT_COLOR;
        const secondary = primary ? generateSecondaryColor(primary) : '#ffffff';
        stops = [
            {
                id: 'stop-0',
                offset: 0,
                color: primary || DEFAULT_COLOR,
                opacity: fallback ? fallback.alpha : 1
            },
            {id: 'stop-1', offset: 1, color: secondary || '#ffffff', opacity: 1}
        ];
    }

    const item = first ? first.item : targets[0];
    const bounds = item.bounds;
    let angle = 0;
    let type = 'linear';
    let centerX = 50;
    let centerY = 50;
    let radius = 100;

    if (first) {
        const color = first.color;
        const direction = color.destination.subtract(color.origin);
        angle = Math.round(Math.atan2(direction.y, direction.x) * 180 / Math.PI);
        if (color.gradient.radial) {
            type = 'radial';
            centerX = bounds.width ? ((color.origin.x - bounds.left) / bounds.width) * 100 : 50;
            centerY = bounds.height ? ((color.origin.y - bounds.top) / bounds.height) * 100 : 50;
            const maximum = Math.max(bounds.width, bounds.height) / 2;
            radius = maximum ? (color.origin.getDistance(color.destination) / maximum) * 100 : 100;
        }
    }

    return {
        targets,
        type,
        angle,
        centerX: clamp(centerX, -100, 200),
        centerY: clamp(centerY, -100, 200),
        radius: clamp(radius, 1, 300),
        stops
    };
};

export const snapshotTargets = (targets, isStroke) => {
    const prop = getColorProp(isStroke);
    return targets.map(item => ({
        item,
        color: item[prop] ? item[prop].clone() : null,
        strokeWidth: item.strokeWidth
    }));
};

export const restoreTargets = (snapshot, isStroke) => {
    const prop = getColorProp(isStroke);
    for (const entry of snapshot) {
        entry.item[prop] = entry.color ? entry.color.clone() : null;
        if (isStroke && entry.strokeWidth !== undefined) entry.item.strokeWidth = entry.strokeWidth;
    }
};

const createGradientForItem = (item, spec, isStroke) => {
    const bounds = item.bounds;
    const stops = spec.stops
        .slice()
        .sort((a, b) => a.offset - b.offset)
        .map(stop => ({
            color: colorToCss(stop.color, stop.opacity),
            offset: clamp(stop.offset, 0, 1)
        }));
    if (stops.length < MIN_STOPS) return null;

    const center = bounds.center;
    let origin;
    let destination;
    if (spec.type === 'radial') {
        origin = new paper.Point(
            bounds.left + ((clamp(spec.centerX, -100, 200) / 100) * bounds.width),
            bounds.top + ((clamp(spec.centerY, -100, 200) / 100) * bounds.height)
        );
        const maximum = Math.max(bounds.width, bounds.height) / 2;
        destination = origin.add(new paper.Point(
            Math.max(1e-2, (clamp(spec.radius, 1, 300) / 100) * maximum),
            0
        ));
    } else {
        const radians = (Number(spec.angle) || 0) * Math.PI / 180;
        const direction = new paper.Point(Math.cos(radians), Math.sin(radians));
        const halfLength = (Math.abs(direction.x) * bounds.width +
            Math.abs(direction.y) * bounds.height) / 2;
        origin = center.subtract(direction.multiply(halfLength));
        destination = center.add(direction.multiply(halfLength));
    }

    return new paper.Color({
        gradient: {
            stops,
            radial: spec.type === 'radial'
        },
        origin,
        destination
    });
};

export const applyGradient = (spec, isStroke) => {
    const targets = spec.targets || getTargets(isStroke);
    if (!targets.length) return false;
    const prop = getColorProp(isStroke);
    let changed = false;
    for (const item of targets) {
        const gradient = createGradientForItem(item, spec, isStroke);
        if (!gradient) continue;
        item[prop] = gradient;
        if (isStroke && item.strokeWidth === 0) item.strokeWidth = 1;
        changed = true;
    }
    return changed;
};
