import paper from '@scratch/paper';
import {getSelectedRootItems} from './selection';

// Lightweight, non-destructive effects. Effect settings live in item.data so
// they survive paper item cloning/serialization and can be reapplied by the
// SVG exporter.
export const DEFAULT_EFFECT = {
    type: 'none',
    blur: 8,
    offsetX: 6,
    offsetY: 6,
    color: '#000000',
    opacity: 0.5
};

const VALID_TYPES = new Set(['none', 'blur', 'shadow', 'glow']);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const normalizeEffect = effect => {
    const source = effect && typeof effect === 'object' ? effect : {};
    const type = VALID_TYPES.has(source.type) ? source.type : DEFAULT_EFFECT.type;
    const opacity = Number(source.opacity);
    return {
        type,
        blur: Math.max(0, Math.min(100, Number(source.blur) || 0)),
        offsetX: Math.max(-100, Math.min(100, Number(source.offsetX) || 0)),
        offsetY: Math.max(-100, Math.min(100, Number(source.offsetY) || 0)),
        color: HEX_COLOR.test(source.color) ? source.color : DEFAULT_EFFECT.color,
        opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : DEFAULT_EFFECT.opacity
    };
};

const itemEffect = item => {
    if (!item || !item.data || !item.data.effect) return null;
    const effect = normalizeEffect(item.data.effect);
    return effect.type === 'none' ? null : effect;
};

export const getSelectionEffect = () => {
    const items = getSelectedRootItems();
    for (const item of items) {
        const effect = itemEffect(item);
        if (effect) return effect;
    }
    return {...DEFAULT_EFFECT};
};

export const hasSelectionEffect = () => {
    const items = getSelectedRootItems();
    return items.some(item => Boolean(itemEffect(item)));
};

export const applyEffectToSelection = effect => {
    const items = getSelectedRootItems();
    if (!items.length) return false;
    const next = normalizeEffect(effect);
    for (const item of items) {
        if (!item.data) item.data = {};
        if (next.type === 'none') {
            delete item.data.effect;
        } else {
            item.data.effect = {...next};
        }
    }
    return true;
};

const rgba = (color, opacity) => {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color || '#000000');
    const r = match ? parseInt(match[1], 16) : 0;
    const g = match ? parseInt(match[2], 16) : 0;
    const b = match ? parseInt(match[3], 16) : 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, Number(opacity) || 0))})`;
};

const cssFilter = (effect, scale) => {
    const blur = Math.max(0, Number(effect.blur) || 0) * scale;
    const dx = (Number(effect.offsetX) || 0) * scale;
    const dy = (Number(effect.offsetY) || 0) * scale;
    const color = rgba(effect.color, effect.opacity);
    if (effect.type === 'blur') return `blur(${blur}px)`;
    if (effect.type === 'glow') return `drop-shadow(0px 0px ${blur}px ${color})`;
    if (effect.type === 'shadow') return `drop-shadow(${dx}px ${dy}px ${blur}px ${color})`;
    return 'none';
};

// Canvas preview. Paper.js draws each item through Item#draw; wrapping it lets
// us apply a per-item canvas filter without changing the document geometry.
const PATCH_KEY = '__costumeStudioEffectsRenderer';
const installRenderer = () => {
    if (!paper.Item || !paper.Item.prototype || paper.Item.prototype[PATCH_KEY]) return;
    const originalDraw = paper.Item.prototype.draw;
    if (typeof originalDraw !== 'function') return;
    paper.Item.prototype.draw = function (ctx, param, parentStrokeMatrix) {
        const effect = itemEffect(this);
        if (!effect || !ctx || !('filter' in ctx)) {
            return originalDraw.apply(this, arguments);
        }
        const zoom = paper.view && paper.view.zoom ? paper.view.zoom : 1;
        const pixelRatio = param && param.pixelRatio ? param.pixelRatio : 1;
        const previous = ctx.filter || 'none';
        try {
            ctx.filter = cssFilter(effect, zoom * pixelRatio);
            return originalDraw.apply(this, arguments);
        } finally {
            ctx.filter = previous;
        }
    };
    paper.Item.prototype[PATCH_KEY] = true;
};

installRenderer();

const SVG_NS = 'http://www.w3.org/2000/svg';

const makeSvgFilter = (doc, effect, id, scale) => {
    const filter = doc.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', '-100%');
    filter.setAttribute('y', '-100%');
    filter.setAttribute('width', '300%');
    filter.setAttribute('height', '300%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    if (effect.type === 'blur') {
        const blur = doc.createElementNS(SVG_NS, 'feGaussianBlur');
        blur.setAttribute('stdDeviation', String(Math.max(0, effect.blur) * scale));
        filter.appendChild(blur);
        return filter;
    }

    const dropShadow = doc.createElementNS(SVG_NS, 'feDropShadow');
    const isGlow = effect.type === 'glow';
    dropShadow.setAttribute('dx', String((isGlow ? 0 : effect.offsetX) * scale));
    dropShadow.setAttribute('dy', String((isGlow ? 0 : effect.offsetY) * scale));
    dropShadow.setAttribute('stdDeviation', String(Math.max(0, effect.blur) * scale));
    dropShadow.setAttribute('flood-color', effect.color);
    dropShadow.setAttribute('flood-opacity', String(effect.opacity));
    filter.appendChild(dropShadow);
    return filter;
};

/**
 * Add SVG filters for effects stored in `data-paper-data`.
 * @param {string} svg SVG string from paper.project.exportSVG
 * @param {number} scale Export scale applied to the paper layer (usually 0.5)
 * @returns {string} SVG with filter definitions
 */
export const applyEffectsToSvg = (svg, scale = 1) => {
    if (typeof svg !== 'string' || svg.indexOf('data-paper-data') === -1) return svg;
    if (typeof DOMParser === 'undefined') return svg;
    let doc;
    try {
        doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    } catch (error) {
        return svg;
    }
    if (!doc || doc.querySelector('parsererror')) return svg;

    let defs = null;
    let applied = false;
    let counter = 0;
    for (const node of Array.from(doc.querySelectorAll('[data-paper-data]'))) {
        let data;
        try {
            data = JSON.parse(node.getAttribute('data-paper-data'));
        } catch (error) {
            continue;
        }
        const effect = normalizeEffect(data && data.effect);
        if (effect.type === 'none') continue;
        if (!defs) {
            defs = doc.createElementNS(SVG_NS, 'defs');
            doc.documentElement.insertBefore(defs, doc.documentElement.firstChild);
        }
        const id = `cs-effect-${++counter}`;
        defs.appendChild(makeSvgFilter(doc, effect, id, scale));
        node.setAttribute('filter', `url(#${id})`);
        applied = true;
    }
    if (!applied) return svg;
    return new XMLSerializer().serializeToString(doc.documentElement);
};
