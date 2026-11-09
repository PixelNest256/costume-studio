import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';

import StrokeToggleComponent from '../components/stroke-toggle.jsx';
import {getSelectedLeafItems} from '../helper/selection';
import {getSelectionStrokeEnabled, setStrokeDisabledForSelection} from '../helper/stroke-state';
import {setSelectedItems as setSelectedItemsAction} from '../reducers/selected-items';
import {changeStrokeColor} from '../reducers/stroke-style';
import {changeStrokeWidth} from '../reducers/stroke-width';

const StrokeToggle = ({disabled, onUpdateImage, selectedItems, setSelectedItems, strokeColor, strokeWidth,
    onChangeStrokeColor, onChangeStrokeWidth}) => {
    const hasSelection = selectedItems.length > 0;
    const checked = hasSelection ? getSelectionStrokeEnabled() : Boolean(strokeColor);
    const activeStrokeRef = React.useRef({color: strokeColor, width: strokeWidth});
    return (
        <StrokeToggleComponent
            checked={checked}
            disabled={disabled}
            onChange={nextChecked => {
                if (hasSelection) {
                    if (!setStrokeDisabledForSelection(!nextChecked)) return;
                    setSelectedItems();
                    onUpdateImage();
                    return;
                }
                // With no object selected there is no item to hold the hidden
                // style. Keep it in this component and toggle the active
                // stroke color used by the next drawing operation.
                if (nextChecked) {
                    const saved = activeStrokeRef.current;
                    onChangeStrokeColor(saved.color || '#000');
                    onChangeStrokeWidth(saved.width || 4);
                } else {
                    activeStrokeRef.current = {
                        color: strokeColor || '#000',
                        width: strokeWidth || 4
                    };
                    onChangeStrokeColor(null);
                }
            }}
        />
    );
};

StrokeToggle.propTypes = {
    disabled: PropTypes.bool,
    onUpdateImage: PropTypes.func.isRequired,
    selectedItems: PropTypes.array,
    setSelectedItems: PropTypes.func.isRequired,
    strokeColor: PropTypes.string,
    strokeWidth: PropTypes.number,
    onChangeStrokeColor: PropTypes.func.isRequired,
    onChangeStrokeWidth: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    selectedItems: state.scratchPaint.selectedItems || [],
    strokeColor: state.scratchPaint.color.strokeColor.primary,
    strokeWidth: state.scratchPaint.color.strokeWidth
});
const mapDispatchToProps = dispatch => ({
    setSelectedItems: () => {
        dispatch(setSelectedItemsAction(getSelectedLeafItems(), false));
    },
    onChangeStrokeColor: color => {
        dispatch(changeStrokeColor(color));
    },
    onChangeStrokeWidth: width => {
        dispatch(changeStrokeWidth(width));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(StrokeToggle);
