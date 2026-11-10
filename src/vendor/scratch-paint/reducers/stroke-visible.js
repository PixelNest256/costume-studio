import {CHANGE_SELECTED_ITEMS} from './selected-items';
import {hasVisibleStroke} from '../helper/stroke-state';

const SET_STROKE_VISIBLE = 'scratch-paint/stroke-visible/SET_STROKE_VISIBLE';
const initialState = true;

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_STROKE_VISIBLE:
        return Boolean(action.visible);
    case CHANGE_SELECTED_ITEMS:
        // Keep the active drawing style in sync with the selection. With no
        // selection the user's own visibility choice is preserved.
        if (!action.selectedItems || !action.selectedItems.length) return state;
        return action.selectedItems.every(hasVisibleStroke);
    default:
        return state;
    }
};

const setStrokeVisible = visible => ({
    type: SET_STROKE_VISIBLE,
    visible
});

export {
    reducer as default,
    setStrokeVisible,
    SET_STROKE_VISIBLE
};
