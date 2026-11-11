import React, {useEffect, useRef, useState} from 'react';
import {defineMessages} from 'react-intl';
import classNames from 'classnames';
import Popover from 'react-popover';

import ButtonGroup from '../button-group/button-group.jsx';
import ColorButton from '../color-button/color-button.jsx';
import InputGroup from '../input-group/input-group.jsx';
import Label from '../forms/label.jsx';
import Input from '../forms/input.jsx';
import LiveInputHOC from '../forms/live-input-hoc.jsx';
import ColorPicker from '../../containers/color-picker.jsx';
import GradientTypes from '../../lib/gradient-types';
import {DEFAULT_EFFECT} from '../../helper/effects';
import {addColorHistory} from '../../../../lib/color-history.js';
import styles from './mode-tools.css';

import noneIcon from './icons/effect-none.svg';
import blurIcon from './icons/effect-blur.svg';
import shadowIcon from './icons/effect-shadow.svg';
import glowIcon from './icons/effect-glow.svg';

const LiveInput = LiveInputHOC(Input);

const messages = defineMessages({
    effect: {defaultMessage: 'Effect', id: 'paint.modeTools.effect'},
    none: {defaultMessage: 'None', id: 'paint.modeTools.effectNone'},
    blur: {defaultMessage: 'Blur', id: 'paint.modeTools.effectBlur'},
    shadow: {defaultMessage: 'Shadow', id: 'paint.modeTools.effectShadow'},
    glow: {defaultMessage: 'Glow', id: 'paint.modeTools.effectGlow'},
    amount: {defaultMessage: 'Amount', id: 'paint.modeTools.effectBlurRadius'},
    offsetX: {defaultMessage: 'X', id: 'paint.modeTools.effectOffsetX'},
    offsetY: {defaultMessage: 'Y', id: 'paint.modeTools.effectOffsetY'},
    color: {defaultMessage: 'Color', id: 'paint.modeTools.effectColor'},
    opacity: {defaultMessage: 'Opacity', id: 'paint.modeTools.effectOpacity'},
    selectObject: {defaultMessage: 'Select an object', id: 'paint.modeTools.effectSelectObject'}
});

const typeConfig = {
    none: {label: messages.none, icon: noneIcon},
    blur: {label: messages.blur, icon: blurIcon},
    shadow: {label: messages.shadow, icon: shadowIcon},
    glow: {label: messages.glow, icon: glowIcon}
};

const parsePickedColor = color => {
    if (typeof color !== 'string') return null;
    const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color);
    if (!match) return null;
    return {
        color: `#${match[1].toLowerCase()}`,
        opacity: match[2] ? Math.round((parseInt(match[2], 16) / 255) * 100) / 100 : 1
    };
};

const colorWithOpacity = (color, opacity) => {
    const alpha = Math.max(0, Math.min(1, Number(opacity) || 0));
    return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
};

const EffectsTools = ({effect, disabled, onChange, intl}) => {
    const value = {...DEFAULT_EFFECT, ...(effect || {})};
    const [colorOpen, setColorOpen] = useState(false);
    const lastColor = useRef(value.color);
    const colorChanged = useRef(false);

    useEffect(() => {
        if (disabled || value.type === 'none') setColorOpen(false);
    }, [disabled, value.type]);

    const update = (patch, commit = true) => {
        if (!disabled) onChange(patch, commit);
    };
    const changeType = type => {
        if (type === 'glow' && value.type !== 'glow' && value.color === DEFAULT_EFFECT.color) {
            update({type, color: '#66ccff'});
        } else {
            update({type});
        }
    };
    const openColor = () => {
        lastColor.current = value.color;
        colorChanged.current = false;
        setColorOpen(true);
    };
    const closeColor = () => {
        setColorOpen(false);
        if (colorChanged.current) {
            addColorHistory(lastColor.current);
            colorChanged.current = false;
            // Apply the accumulated color change and record one undo step.
            update({}, true);
        }
    };
    const handleColorChange = color => {
        if (color === null) {
            // Effects have no transparent color; treat the no-fill swatch as
            // zero opacity so the picker remains consistent with fill/stroke.
            colorChanged.current = true;
            update({opacity: 0}, false);
            return;
        }
        const picked = parsePickedColor(color);
        if (!picked) return;
        lastColor.current = picked.color;
        colorChanged.current = true;
        // Preview on the canvas without exporting the SVG on every pointer move.
        update({color: picked.color, opacity: picked.opacity}, false);
    };
    return (
        <div className={styles.effectsTools}>
            <span className={styles.effectsTitle}>{intl.formatMessage(messages.effect)}</span>
            <InputGroup className={classNames(styles.modDashedBorder, styles.modLabeledIconHeight)}>
                <ButtonGroup className={styles.effectTypeGroup}>
                    {Object.keys(typeConfig).map(type => {
                        const config = typeConfig[type];
                        return (
                            <button
                                aria-pressed={value.type === type}
                                className={classNames(styles.effectTypeButton, {
                                    [styles.effectTypeSelected]: value.type === type
                                })}
                                disabled={disabled}
                                key={type}
                                onClick={() => changeType(type)}
                                title={intl.formatMessage(config.label)}
                                type="button"
                            >
                                <img
                                    alt=""
                                    className={styles.effectTypeIcon}
                                    draggable={false}
                                    src={config.icon}
                                />
                                <span className={styles.effectTypeLabel}>
                                    {intl.formatMessage(config.label)}
                                </span>
                            </button>
                        );
                    })}
                </ButtonGroup>
            </InputGroup>
            {disabled ? (
                <span className={styles.effectHint}>{intl.formatMessage(messages.selectObject)}</span>
            ) : value.type === 'none' ? null : (
                <>
                    <Label text={intl.formatMessage(messages.amount)}>
                        <LiveInput
                            max={100}
                            min={0}
                            onSubmit={blur => update({blur})}
                            range
                            small
                            type="number"
                            value={value.blur}
                        />
                    </Label>
                    {value.type === 'shadow' ? (
                        <>
                            <Label text={intl.formatMessage(messages.offsetX)}>
                                <LiveInput
                                    max={100}
                                    min={-100}
                                    onSubmit={offsetX => update({offsetX})}
                                    range
                                    small
                                    type="number"
                                    value={value.offsetX}
                                />
                            </Label>
                            <Label text={intl.formatMessage(messages.offsetY)}>
                                <LiveInput
                                    max={100}
                                    min={-100}
                                    onSubmit={offsetY => update({offsetY})}
                                    range
                                    small
                                    type="number"
                                    value={value.offsetY}
                                />
                            </Label>
                        </>
                    ) : null}
                    {value.type !== 'blur' ? (
                        <>
                            <Popover
                                body={
                                    <ColorPicker
                                        color={colorWithOpacity(value.color, value.opacity)}
                                        color2={colorWithOpacity(value.color, value.opacity)}
                                        gradientType={GradientTypes.SOLID}
                                        shouldShowGradientTools={false}
                                        onChangeColor={handleColorChange}
                                        onChangeGradientType={() => {}}
                                        onSwap={() => {}}
                                    />
                                }
                                isOpen={colorOpen}
                                preferPlace="below"
                                onOuterAction={closeColor}
                            >
                                <Label text={intl.formatMessage(messages.color)}>
                                    <ColorButton
                                        color={value.color}
                                        gradientType={GradientTypes.SOLID}
                                        onClick={colorOpen ? closeColor : openColor}
                                    />
                                </Label>
                            </Popover>
                            <Label text={intl.formatMessage(messages.opacity)}>
                                <LiveInput
                                    className={styles.effectOpacityInput}
                                    max={1}
                                    min={0}
                                    onSubmit={opacity => update({opacity})}
                                    range
                                    small
                                    step="0.05"
                                    type="number"
                                    value={value.opacity}
                                />
                            </Label>
                        </>
                    ) : null}
                </>
            )}
        </div>
    );
};

export default EffectsTools;
