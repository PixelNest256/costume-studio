import classNames from 'classnames';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import React, {useEffect, useRef, useState} from 'react';
import MediaQuery from 'react-responsive';

import {shouldShowGroup, shouldShowUngroup} from '../../helper/group';
import {shouldShowBringForward, shouldShowSendBackward} from '../../helper/order';

import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import Button from '../button/button.jsx';
import ButtonGroup from '../button-group/button-group.jsx';
import Dropdown from '../dropdown/dropdown.jsx';
import {defineMessages, useIntl} from 'react-intl';
import Formats, {isVector} from '../../lib/format';
import Input from '../forms/input.jsx';
import InputGroup from '../input-group/input-group.jsx';
import Label from '../forms/label.jsx';
import LabeledIconButton from '../labeled-icon-button/labeled-icon-button.jsx';
import layout from '../../lib/layout-constants';
import {hideLabel} from '../../lib/hide-label';
import styles from './fixed-tools.css';

import cropIcon from './icons/crop.svg';
import groupIcon from './icons/group.svg';
import redoIcon from './icons/redo.svg';
import sendBackIcon from './icons/send-back.svg';
import sendBackwardIcon from './icons/send-backward.svg';
import sendForwardIcon from './icons/send-forward.svg';
import sendFrontIcon from './icons/send-front.svg';
import undoIcon from './icons/undo.svg';
import ungroupIcon from './icons/ungroup.svg';

const BufferedInput = BufferedInputHOC(Input);
const messages = defineMessages({
    costume: {
        id: 'paint.paintEditor.costume',
        description: 'Label for the name of a costume',
        defaultMessage: 'Costume'
    },
    group: {
        defaultMessage: 'Group',
        description: 'Label for the button to group shapes',
        id: 'paint.paintEditor.group'
    },
    ungroup: {
        defaultMessage: 'Ungroup',
        description: 'Label for the button to ungroup shapes',
        id: 'paint.paintEditor.ungroup'
    },
    undo: {
        defaultMessage: 'Undo',
        description: 'Alt to image for the button to undo an action',
        id: 'paint.paintEditor.undo'
    },
    redo: {
        defaultMessage: 'Redo',
        description: 'Alt to image for the button to redo an action',
        id: 'paint.paintEditor.redo'
    },
    forward: {
        defaultMessage: 'Forward',
        description: 'Label for the `Send forward on canvas` button',
        id: 'paint.paintEditor.forward'
    },
    backward: {
        defaultMessage: 'Backward',
        description: 'Label for the `Send backward on canvas` button',
        id: 'paint.paintEditor.backward'
    },
    front: {
        defaultMessage: 'Front',
        description: 'Label for the `Send to front of canvas` button',
        id: 'paint.paintEditor.front'
    },
    back: {
        defaultMessage: 'Back',
        description: 'Label for the `Send to back of canvas` button',
        id: 'paint.paintEditor.back'
    },
    more: {
        defaultMessage: 'More',
        description: 'Label for dropdown to access more action buttons',
        id: 'paint.paintEditor.more'
    },
    crop: {
        defaultMessage: 'Crop to selection',
        description: 'Label for button that crops the image to the current selection (bitmap: trims transparent edges)',
        id: 'paint.paintEditor.crop'
    }
});

const FixedToolsComponent = props => {
    const redoDisabled = !props.canRedo();
    const undoDisabled = !props.canUndo();
    const intl = useIntl();
    const toolbarRef = useRef(null);
    const [toolbarWidth, setToolbarWidth] = useState(0);
    useEffect(() => {
        const element = toolbarRef.current;
        if (!element) return undefined;
        const updateWidth = () => setToolbarWidth(Math.round(element.getBoundingClientRect().width));
        updateWidth();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateWidth);
            return () => window.removeEventListener('resize', updateWidth);
        }
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const showCrop = toolbarWidth >= 520;
    const showGroup = isVector(props.format) && toolbarWidth >= 640;
    const showForward = isVector(props.format) && toolbarWidth >= 750;
    const showFront = isVector(props.format) && toolbarWidth >= 880;
    const overflowItems = [];
    const makeMenuItem = (key, title, icon, disabled, onClick) => (
        <Button
            className={classNames(styles.modMenuItem, {[styles.modDisabled]: disabled})}
            disabled={disabled}
            key={key}
            onClick={onClick}
        >
            <img className={styles.menuItemIcon} draggable={false} src={icon}/>
            <span>{title}</span>
        </Button>
    );
    if (!showCrop) {
        overflowItems.push(makeMenuItem('crop', intl.formatMessage(messages.crop), cropIcon, false, props.onCrop));
    }
    if (isVector(props.format) && !showGroup) {
        overflowItems.push(makeMenuItem('group', intl.formatMessage(messages.group), groupIcon, !shouldShowGroup(), props.onGroup));
        overflowItems.push(makeMenuItem('ungroup', intl.formatMessage(messages.ungroup), ungroupIcon, !shouldShowUngroup(), props.onUngroup));
    }
    if (isVector(props.format) && !showForward) {
        overflowItems.push(makeMenuItem('forward', intl.formatMessage(messages.forward), sendForwardIcon, !shouldShowBringForward(), props.onSendForward));
        overflowItems.push(makeMenuItem('backward', intl.formatMessage(messages.backward), sendBackwardIcon, !shouldShowSendBackward(), props.onSendBackward));
    }
    if (isVector(props.format) && !showFront) {
        overflowItems.push(makeMenuItem('front', intl.formatMessage(messages.front), sendFrontIcon, !shouldShowBringForward(), props.onSendToFront));
        overflowItems.push(makeMenuItem('back', intl.formatMessage(messages.back), sendBackIcon, !shouldShowSendBackward(), props.onSendToBack));
    }

    return (
        <div className={classNames(styles.row, styles.toolbarRow)} ref={toolbarRef}>
            {/* Name field */}
            <InputGroup>
                <MediaQuery minWidth={layout.fullSizeEditorMinWidth}>
                    <Label text={intl.formatMessage(messages.costume)}>
                        <BufferedInput
                            className={styles.costumeInput}
                            type="text"
                            value={props.name}
                            onSubmit={props.onUpdateName}
                        />
                    </Label>
                </MediaQuery>
                <MediaQuery maxWidth={layout.fullSizeEditorMinWidth - 1}>
                    <BufferedInput
                        className={styles.costumeInput}
                        type="text"
                        value={props.name}
                        onSubmit={props.onUpdateName}
                    />
                </MediaQuery>
            </InputGroup>

            {/* Undo/Redo */}
            <InputGroup>
                <ButtonGroup>
                    <Button
                        className={
                            classNames(
                                styles.buttonGroupButton,
                                {
                                    [styles.modNoEndBorder]: !redoDisabled
                                }
                            )
                        }
                        disabled={undoDisabled}
                        onClick={props.onUndo}
                    >
                        <img
                            alt={intl.formatMessage(messages.undo)}
                            className={classNames(
                                styles.buttonGroupButtonIcon,
                                styles.undoIcon
                            )}
                            draggable={false}
                            src={undoIcon}
                        />
                    </Button>
                    <Button
                        className={
                            classNames(
                                styles.buttonGroupButton,
                                {
                                    [styles.modStartBorder]: !redoDisabled
                                }
                            )
                        }
                        disabled={redoDisabled}
                        onClick={props.onRedo}
                    >
                        <img
                            alt={intl.formatMessage(messages.redo)}
                            className={styles.buttonGroupButtonIcon}
                            draggable={false}
                            src={redoIcon}
                        />
                    </Button>
                </ButtonGroup>
            </InputGroup>

            {/* Crop */}
            {showCrop ? (
                <InputGroup className={styles.modDashedBorder}>
                    <LabeledIconButton
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={cropIcon}
                        title={intl.formatMessage(messages.crop)}
                        onClick={props.onCrop}
                    />
                </InputGroup>
            ) : null}

            {/* Group/Ungroup */}
            {showGroup ?
                <InputGroup className={styles.modDashedBorder}>
                    <LabeledIconButton
                        disabled={!shouldShowGroup()}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={groupIcon}
                        title={intl.formatMessage(messages.group)}
                        onClick={props.onGroup}
                    />
                    <LabeledIconButton
                        disabled={!shouldShowUngroup()}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={ungroupIcon}
                        title={intl.formatMessage(messages.ungroup)}
                        onClick={props.onUngroup}
                    />
                </InputGroup> : null
            }

            {/* Forward/Backward */}
            {showForward ?
                <InputGroup className={styles.modDashedBorder}>
                    <LabeledIconButton
                        disabled={!shouldShowBringForward()}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={sendForwardIcon}
                        title={intl.formatMessage(messages.forward)}
                        onClick={props.onSendForward}
                    />
                    <LabeledIconButton
                        disabled={!shouldShowSendBackward()}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={sendBackwardIcon}
                        title={intl.formatMessage(messages.backward)}
                        onClick={props.onSendBackward}
                    />
                </InputGroup> : null
            }

            {showFront ? (
                <InputGroup className={styles.row}>
                    <LabeledIconButton
                        disabled={!shouldShowBringForward()}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={sendFrontIcon}
                        title={intl.formatMessage(messages.front)}
                        onClick={props.onSendToFront}
                    />
                    <LabeledIconButton
                        disabled={!shouldShowSendBackward()}
                        hideLabel={hideLabel(intl.locale)}
                        imgSrc={sendBackIcon}
                        title={intl.formatMessage(messages.back)}
                        onClick={props.onSendToBack}
                    />
                </InputGroup>
            ) : null}
            {overflowItems.length ? (
                <InputGroup>
                    <Dropdown
                        className={styles.modUnselect}
                        enterExitTransitionDurationMs={20}
                        popoverContent={
                            <InputGroup className={styles.modContextMenu} rtl={props.rtl}>
                                {overflowItems}
                            </InputGroup>
                        }
                        tipSize={.01}
                    >
                        {intl.formatMessage(messages.more)}
                    </Dropdown>
                </InputGroup>
            ) : null}
        </div>
    );
};

FixedToolsComponent.propTypes = {
    canRedo: PropTypes.func.isRequired,
    canUndo: PropTypes.func.isRequired,
    format: PropTypes.oneOf(Object.keys(Formats)),
    name: PropTypes.string,
    onCrop: PropTypes.func.isRequired,
    onGroup: PropTypes.func.isRequired,
    onRedo: PropTypes.func.isRequired,
    onSendBackward: PropTypes.func.isRequired,
    onSendForward: PropTypes.func.isRequired,
    onSendToBack: PropTypes.func.isRequired,
    onSendToFront: PropTypes.func.isRequired,
    onUndo: PropTypes.func.isRequired,
    onUngroup: PropTypes.func.isRequired,
    onUpdateName: PropTypes.func.isRequired,
    rtl: PropTypes.bool.isRequired
};

const mapStateToProps = state => ({
    format: state.scratchPaint.format,
    rtl: state.scratchPaint.layout.rtl,
    selectedItems: state.scratchPaint.selectedItems,
    undoState: state.scratchPaint.undo
});

export default connect(
    mapStateToProps
)(FixedToolsComponent);
