import paper from '@scratch/paper';
import {getSelectedLeafItems} from './selection';

const isCompoundChild = item => item.parent instanceof paper.CompoundPath;
const targetItem = item => (isCompoundChild(item) ? item.parent : item);

export const getStrokeStyle = item => {
    const target = targetItem(item);
    return target && target.data ? target.data.strokeStyle : null;
};

export const isStrokeDisabled = item => {
    const target = targetItem(item);
    return Boolean(target && target.data && target.data.strokeDisabled);
};

const rememberStroke = item => {
    const target = targetItem(item);
    if (!target || target.data === null || typeof target.data === 'undefined') return;
    if (!target.data.strokeStyle) {
        target.data.strokeStyle = {
            color: target.strokeColor || null,
            width: Number(target.strokeWidth) || 0
        };
    }
};

export const setStrokeDisabled = (item, disabled) => {
    const target = targetItem(item);
    if (!target) return false;
    if (!target.data) target.data = {};
    if (disabled) {
        if (target.data.strokeDisabled) return false;
        // Snapshot the current style every time it is hidden. Reusing an old
        // snapshot would restore a stale color/width after a hide-show-hide
        // cycle, for example after the user changes the stroke in between.
        target.data.strokeStyle = {
            color: target.strokeColor || null,
            width: Number(target.strokeWidth) || 0
        };
        target.data.strokeDisabled = true;
        target.strokeColor = null;
        target.strokeWidth = 0;
        return true;
    }
    if (!target.data.strokeDisabled) return false;
    const saved = target.data.strokeStyle;
    if (saved) {
        target.strokeColor = saved.color || null;
        target.strokeWidth = Number(saved.width) || 0;
    }
    delete target.data.strokeDisabled;
    return true;
};

export const setStrokeDisabledForSelection = disabled => {
    const items = getSelectedLeafItems();
    let changed = false;
    for (const item of items) {
        changed = setStrokeDisabled(item, disabled) || changed;
    }
    return changed;
};

export const getSelectionStrokeDisabled = () => {
    const items = getSelectedLeafItems();
    if (!items.length) return false;
    return items.every(item => isStrokeDisabled(item));
};

export const hasVisibleStroke = item => {
    const target = targetItem(item);
    return Boolean(target &&
        !isStrokeDisabled(target) &&
        target.strokeColor &&
        target.strokeColor.alpha !== 0 &&
        Number(target.strokeWidth) > 0);
};

export const getSelectionStrokeEnabled = () => {
    const items = getSelectedLeafItems();
    if (!items.length) return false;
    // An unchecked item is not merely one with strokeDisabled; it also
    // includes newly created/imported artwork that has no visible stroke yet.
    return items.every(item => hasVisibleStroke(item));
};

export const enableStrokeForSelection = () => {
    const items = getSelectedLeafItems();
    let changed = false;
    for (const item of items) {
        const target = targetItem(item);
        if (!target) continue;
        if (!target.data) target.data = {};

        if (target.data.strokeDisabled) {
            const saved = target.data.strokeStyle;
            const savedColor = saved && saved.color;
            const savedWidth = saved && Number(saved.width);
            target.strokeColor = savedColor && savedColor.alpha !== 0 ? savedColor : '#000';
            target.strokeWidth = savedWidth > 0 ? savedWidth : 1;
            delete target.data.strokeDisabled;
            changed = true;
            continue;
        }

        let color = target.strokeColor;
        let width = Number(target.strokeWidth) || 0;
        if (!color || color.alpha === 0) {
            color = '#000';
            width = 1;
            changed = true;
        } else if (width <= 0) {
            width = 1;
            changed = true;
        }
        target.strokeColor = color;
        target.strokeWidth = width;
    }
    return changed;
};

// Keep the saved payload current while the stroke is hidden. This is what
// makes the checkbox reversible without changing the visible style controls.
export const updateSavedStrokeColor = (item, colorString) => {
    const target = targetItem(item);
    if (!target || !target.data) return;
    rememberStroke(target);
    if (target.data.strokeStyle) {
        target.data.strokeStyle.color = colorString === null ? null : new paper.Color(colorString);
    }
};

export const updateSavedStrokeWidth = (item, width) => {
    const target = targetItem(item);
    if (!target || !target.data) return;
    rememberStroke(target);
    if (target.data.strokeStyle) {
        target.data.strokeStyle.width = Number(width) || 0;
    }
};
