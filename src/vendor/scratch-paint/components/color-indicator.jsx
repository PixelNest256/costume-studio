import React from 'react';
import PropTypes from 'prop-types';
import Popover from 'react-popover';

import ColorButton from './color-button/color-button.jsx';
import ColorPicker from '../containers/color-picker.jsx';
import InputGroup from './input-group/input-group.jsx';
import Label from './forms/label.jsx';

import GradientTypes from '../lib/gradient-types';

const ColorIndicatorComponent = props => (
    <InputGroup
        className={props.className}
        disabled={props.disabled}
    >
        <Popover
            body={
                <ColorPicker
                    color={props.color}
                    color2={props.color2}
                    gradientType={props.gradientType}
                    shouldShowGradientTools={props.shouldShowGradientTools}
                    onChangeColor={props.onChangeColor}
                    onChangeGradientType={props.onChangeGradientType}
                    onOpenAdvancedGradient={props.onOpenAdvancedGradient}
                    onSwap={props.onSwap}
                />
            }
            isOpen={props.colorModalVisible}
            preferPlace="below"
            onOuterAction={props.advancedGradientOpen ? () => {} : props.onCloseColor}
        >
            <Label text={props.label}>
                <ColorButton
                    color={props.color}
                    color2={props.color2}
                    gradientType={props.gradientType}
                    // Clicking the swatch again while open closes the picker
                    // (toggle), instead of only ever opening it.
                    onClick={props.colorModalVisible ? props.onCloseColor : props.onOpenColor}
                    outline={props.outline}
                />
            </Label>
        </Popover>
    </InputGroup>
);

ColorIndicatorComponent.propTypes = {
    className: PropTypes.string,
    disabled: PropTypes.bool.isRequired,
    color: PropTypes.string,
    color2: PropTypes.string,
    colorModalVisible: PropTypes.bool.isRequired,
    gradientType: PropTypes.oneOf(Object.keys(GradientTypes)).isRequired,
    advancedGradientOpen: PropTypes.bool,
    label: PropTypes.string.isRequired,
    onChangeColor: PropTypes.func.isRequired,
    onChangeGradientType: PropTypes.func.isRequired,
    onCloseColor: PropTypes.func.isRequired,
    onOpenAdvancedGradient: PropTypes.func,
    onOpenColor: PropTypes.func.isRequired,
    onSwap: PropTypes.func.isRequired,
    outline: PropTypes.bool.isRequired,
    shouldShowGradientTools: PropTypes.bool.isRequired
};

export default ColorIndicatorComponent;
