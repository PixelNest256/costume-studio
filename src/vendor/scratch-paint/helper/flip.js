import paper from '@scratch/paper';
import {getAllRootItems, getSelectedRootItems} from './selection';
import {ensureClockwise} from './math';
import {flipBitmapHorizontal, flipBitmapVertical} from './bitmap';
import {getRaster} from './layer';

/**
 * Flip the current selection (or every object when nothing is selected).
 * Kept in a helper so the canvas keyboard shortcuts and the toolbar buttons
 * use exactly the same behavior.
 */
const flipSelection = (horizontal, isBitmap, onUpdateImage) => {
    const selectedItems = getSelectedRootItems();
    if (isBitmap && selectedItems.length === 0) {
        getRaster().canvas = horizontal ?
            flipBitmapHorizontal(getRaster().canvas) :
            flipBitmapVertical(getRaster().canvas);
        onUpdateImage();
        return;
    }

    const items = selectedItems.length ? selectedItems : getAllRootItems();
    if (!items.length) return;

    // Remember z-indices before grouping so the artwork is returned to the
    // same layer position after flipping.
    for (const item of items) {
        item.data.index = item.index;
    }

    const itemGroup = new paper.Group(items);
    itemGroup.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
    ensureClockwise(itemGroup);

    for (const item of items) {
        itemGroup.layer.insertChild(item.data.index, item);
        item.data.index = null;
    }
    itemGroup.remove();
    onUpdateImage();
};

export {flipSelection};
