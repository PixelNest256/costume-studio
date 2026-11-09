import {normalizeHexColor} from './color-history.js';

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseHex = hex => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return null;
    const value = normalized.slice(1);
    const rgb = value.length === 8 ? value.slice(0, 6) : value;
    return {
        r: parseInt(rgb.slice(0, 2), 16),
        g: parseInt(rgb.slice(2, 4), 16),
        b: parseInt(rgb.slice(4, 6), 16)
    };
};

const toHex = ({r, g, b}) => `#${[r, g, b]
    .map(value => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;

export const mixColors = (a, b, ratio) => {
    const first = parseHex(a);
    const second = parseHex(b);
    if (!first || !second) return null;
    const t = clamp(Number(ratio) / 100, 0, 1);
    return toHex({
        r: first.r + (second.r - first.r) * t,
        g: first.g + (second.g - first.g) * t,
        b: first.b + (second.b - first.b) * t
    });
};

export const rgbToHsv = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return {
        h,
        s: max === 0 ? 0 : (delta / max) * 100,
        v: max * 100
    };
};

export const hsvToRgb = (h, s, v) => {
    const hue = ((Number(h) % 360) + 360) % 360;
    const saturation = clamp(Number(s), 0, 100) / 100;
    const value = clamp(Number(v), 0, 100) / 100;
    const chroma = value * saturation;
    const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - chroma;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hue < 60) [r, g, b] = [chroma, x, 0];
    else if (hue < 120) [r, g, b] = [x, chroma, 0];
    else if (hue < 180) [r, g, b] = [0, chroma, x];
    else if (hue < 240) [r, g, b] = [0, x, chroma];
    else if (hue < 300) [r, g, b] = [x, 0, chroma];
    else [r, g, b] = [chroma, 0, x];
    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255)
    };
};

export const hexToHsv = hex => {
    const rgb = parseHex(hex);
    return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : {h: 0, s: 0, v: 0};
};

export const hsvToHex = (h, s, v) => toHex(hsvToRgb(h, s, v));

export const complementColor = hex => {
    const hsv = hexToHsv(hex);
    return hsvToHex(hsv.h + 180, hsv.s, hsv.v);
};

export const adjustLightness = (hex, amount) => {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    const target = amount >= 0 ? 255 : 0;
    const t = Math.abs(amount);
    return toHex({
        r: rgb.r + (target - rgb.r) * t,
        g: rgb.g + (target - rgb.g) * t,
        b: rgb.b + (target - rgb.b) * t
    });
};

export {parseHex as hexToRgb, toHex as rgbToHex};
