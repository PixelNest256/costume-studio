import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';

import StrokeToggleComponent from '../components/stroke-toggle.jsx';
import {getSelectedLeafItems} from '../helper/selection';
import {getSelectionStrokeEnabled, setStrokeDisabledForSelection} from '../helper/stroke-state';
import {setSelectedItems as setSelectedItemsAction} from '../reducers/selected-items';

const StrokeToggle = ({disabled, onUpdateImage, selectedItems, setSelectedItems}) => {
    const checked = getSelectionStrokeEnabled();
    return (
        <StrokeToggleComponent
            checked={checked}
            disabled={disabled || selectedItems.length === 0}
            onChange={nextChecked => {
                if (!setStrokeDisabledForSelection(!nextChecked)) return;
                setSelectedItems();
                onUpdateImage();
            }}
        />
    );
};

StrokeToggle.propTypes = {
    disabled: PropTypes.bool,
    onUpdateImage: PropTypes.func.isRequired,
    selectedItems: PropTypes.array,
    setSelectedItems: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    selectedItems: state.scratchPaint.selectedItems || []
});
const mapDispatchToProps = dispatch => ({
    setSelectedItems: () => {
        dispatch(setSelectedItemsAction(getSelectedLeafItems(), false));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(StrokeToggle);
