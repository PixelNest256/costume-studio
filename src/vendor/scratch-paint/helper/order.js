import {getSelectedRootItems} from './selection';
import {getActiveLayerId, getLayerItems, normalizeLayerOrder} from './layers';

const reorder = (mode, onUpdateImage) => {
    const items = getSelectedRootItems();
    if (!items.length) return false;
    const layerId = items[0].data ? items[0].data.layerId : getActiveLayerId();
    if (!layerId) return false;
    const layerItems = getLayerItems(layerId);
    const selected = new Set(items);
    const selectedIndexes = items
        .map(item => layerItems.indexOf(item))
        .filter(index => index !== -1)
        .sort((a, b) => a - b);
    if (!selectedIndexes.length) return false;

    let insertion = -1;
    if (mode === 'back') {
        insertion = 0;
    } else if (mode === 'front') {
        insertion = layerItems.length;
    } else if (mode === 'backward') {
        for (let i = selectedIndexes[0] - 1; i >= 0; i--) {
            if (!selected.has(layerItems[i])) {
                insertion = i;
                break;
            }
        }
    } else if (mode === 'forward') {
        for (let i = selectedIndexes[selectedIndexes.length - 1] + 1; i < layerItems.length; i++) {
            if (!selected.has(layerItems[i])) {
                insertion = i;
                break;
            }
        }
    }
    if (insertion < 0) return false;

    const remaining = layerItems.filter(item => !selected.has(item));
    let adjusted = insertion;
    if (mode === 'forward') {
        const next = layerItems[insertion];
        adjusted = remaining.indexOf(next) + 1;
    } else if (mode === 'backward') {
        const previous = layerItems[insertion];
        adjusted = remaining.indexOf(previous);
    } else if (mode === 'front') {
        adjusted = remaining.length;
    } else {
        adjusted = 0;
    }
    const ordered = remaining.slice();
    ordered.splice(adjusted, 0, ...items);

    // Keep the first item in place and stack the others above it. The layer's
    // block order in the painting layer stays intact.
    for (let i = 1; i < ordered.length; i++) {
        ordered[i].insertAbove(ordered[i - 1]);
    }
    normalizeLayerOrder();
    onUpdateImage();
    return true;
};

const bringToFront = onUpdateImage => reorder('front', onUpdateImage);
const sendToBack = onUpdateImage => reorder('back', onUpdateImage);
const bringForward = onUpdateImage => reorder('forward', onUpdateImage);
const sendBackward = onUpdateImage => reorder('backward', onUpdateImage);

const shouldShowSendBackward = function () {
    const items = getSelectedRootItems();
    if (!items.length) return false;
    const layerId = items[0].data ? items[0].data.layerId : getActiveLayerId();
    const layerItems = getLayerItems(layerId);
    return layerItems.length > 0 && layerItems[0] !== items[0] &&
        !items.some(item => layerItems.indexOf(item) < 0);
};

const shouldShowBringForward = function () {
    const items = getSelectedRootItems();
    if (!items.length) return false;
    const layerId = items[0].data ? items[0].data.layerId : getActiveLayerId();
    const layerItems = getLayerItems(layerId);
    if (!layerItems.length) return false;
    const selected = new Set(items);
    const last = Math.max(...items.map(item => layerItems.indexOf(item)));
    return layerItems.slice(last + 1).some(item => !selected.has(item));
};

export {
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    shouldShowBringForward,
    shouldShowSendBackward
};
