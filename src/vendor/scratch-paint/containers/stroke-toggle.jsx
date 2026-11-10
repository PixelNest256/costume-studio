import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';

import StrokeToggleComponent from '../components/stroke-toggle.jsx';
import {getSelectedLeafItems} from '../helper/selection';
import {enableStrokeForSelection, getSelectionStrokeEnabled, setStrokeDisabledForSelection} from '../helper/stroke-state';
import {setSelectedItems as setSelectedItemsAction} from '../reducers/selected-items';
import {changeStrokeColor} from '../reducers/stroke-style';
import {changeStrokeWidth} from '../reducers/stroke-width';
import {setStrokeVisible} from '../reducers/stroke-visible';

const StrokeToggle = ({disabled, onUpdateImage, selectedItems, setSelectedItems, strokeColor, strokeWidth,
    strokeVisible, onChangeStrokeColor, onChangeStrokeWidth, onSetStrokeVisible}) => {
    const hasSelection = selectedItems.length > 0;
    const checked = hasSelection ? getSelectionStrokeEnabled() :
        Boolean(strokeVisible && strokeColor && strokeWidth > 0);
    return (
        <StrokeToggleComponent
            checked={checked}
            disabled={disabled}
            onChange={nextChecked => {
                if (hasSelection) {
                    const changed = nextChecked ?
                        enableStrokeForSelection() :
                        setStrokeDisabledForSelection(true);
                    if (!changed) return;
                    onSetStrokeVisible(nextChecked);
                    setSelectedItems();
                    onUpdateImage();
                    return;
                }
                // With no object selected, keep the active color and width
                // intact. Only the visibility flag changes so the controls
                // remain usable and the outline can be restored at any time.
                onSetStrokeVisible(nextChecked);
                if (nextChecked) {
                    if (!strokeColor) onChangeStrokeColor('#000');
                    if (!(strokeWidth > 0)) onChangeStrokeWidth(1);
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
    strokeVisible: PropTypes.bool,
    onChangeStrokeColor: PropTypes.func.isRequired,
    onChangeStrokeWidth: PropTypes.func.isRequired,
    onSetStrokeVisible: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    selectedItems: state.scratchPaint.selectedItems || [],
    strokeColor: state.scratchPaint.color.strokeColor.primary,
    strokeWidth: state.scratchPaint.color.strokeWidth,
    strokeVisible: state.scratchPaint.color.strokeVisible
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
    },
    onSetStrokeVisible: visible => {
        dispatch(setStrokeVisible(visible));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(StrokeToggle);
