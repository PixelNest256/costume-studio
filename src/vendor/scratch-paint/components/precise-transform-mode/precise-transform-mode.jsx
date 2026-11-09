import React from 'react';
import PropTypes from 'prop-types';
import messages from '../../lib/messages.js';
import ToolSelectComponent from '../tool-select-base/tool-select-base.jsx';

import preciseTransformIcon from './precise-transform.svg';

const PreciseTransformModeComponent = props => (
    <ToolSelectComponent
        toolId="precise-transform"
        imgDescriptor={messages.preciseTransform}
        imgSrc={preciseTransformIcon}
        isSelected={props.isSelected}
        onMouseDown={props.onMouseDown}
    />
);

PreciseTransformModeComponent.propTypes = {
    isSelected: PropTypes.bool.isRequired,
    onMouseDown: PropTypes.func.isRequired
};

export default PreciseTransformModeComponent;
