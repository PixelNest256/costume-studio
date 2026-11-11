import React from 'react';
import PropTypes from 'prop-types';
import messages from '../../lib/messages.js';
import ToolSelectComponent from '../tool-select-base/tool-select-base.jsx';

import effectsIcon from './effects.svg';

const EffectsModeComponent = props => (
    <ToolSelectComponent
        toolId="effects"
        imgDescriptor={messages.effects}
        imgSrc={effectsIcon}
        isSelected={props.isSelected}
        onMouseDown={props.onMouseDown}
    />
);

EffectsModeComponent.propTypes = {
    isSelected: PropTypes.bool.isRequired,
    onMouseDown: PropTypes.func.isRequired
};

export default EffectsModeComponent;
