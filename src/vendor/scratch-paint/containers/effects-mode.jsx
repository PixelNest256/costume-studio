import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {changeMode} from '../reducers/modes';
import Modes from '../lib/modes';
import EffectsModeComponent from '../components/effects-mode/effects-mode.jsx';

const EffectsMode = props => (
    <EffectsModeComponent
        isSelected={props.isSelected}
        onMouseDown={props.onMouseDown}
    />
);

EffectsMode.propTypes = {
    isSelected: PropTypes.bool.isRequired,
    onMouseDown: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    isSelected: state.scratchPaint.mode === Modes.EFFECTS
});
const mapDispatchToProps = dispatch => ({
    onMouseDown: () => dispatch(changeMode(Modes.EFFECTS))
});

export default connect(mapStateToProps, mapDispatchToProps)(EffectsMode);
