// Tools should draw without an outline while the active outline is hidden.
// Keep the original color/width state intact for the color controls.
export const getToolColorState = colorState => {
    if (!colorState || colorState.strokeVisible !== false) return colorState;
    return {...colorState, strokeWidth: 0};
};
