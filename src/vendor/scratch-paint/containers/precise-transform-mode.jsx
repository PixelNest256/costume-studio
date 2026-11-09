import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {changeMode} from '../reducers/modes';
import Modes from '../lib/modes';
import PreciseTransformModeComponent from '../components/precise-transform-mode/precise-transform-mode.jsx';

const PreciseTransformMode = props => (
    <PreciseTransformModeComponent
        isSelected={props.isSelected}
        onMouseDown={props.onMouseDown}
    />
);

PreciseTransformMode.propTypes = {
    isSelected: PropTypes.bool.isRequired,
    onMouseDown: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    isSelected: state.scratchPaint.mode === Modes.PRECISE_TRANSFORM
});
const mapDispatchToProps = dispatch => ({
    onMouseDown: () => dispatch(changeMode(Modes.PRECISE_TRANSFORM))
});

export default connect(mapStateToProps, mapDispatchToProps)(PreciseTransformMode);
