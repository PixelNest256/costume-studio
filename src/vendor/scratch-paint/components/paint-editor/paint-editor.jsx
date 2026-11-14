import paper from '@scratch/paper';
import classNames from 'classnames';
import {defineMessages, useIntl} from 'react-intl';
import React from 'react';
import PropTypes from 'prop-types';

import PaperCanvas from '../../containers/paper-canvas.jsx';
import ScrollableCanvas from '../../containers/scrollable-canvas.jsx';

import BitBrushMode from '../../containers/bit-brush-mode.jsx';
import BitLineMode from '../../containers/bit-line-mode.jsx';
import BitOvalMode from '../../containers/bit-oval-mode.jsx';
import BitRectMode from '../../containers/bit-rect-mode.jsx';
import BitFillMode from '../../containers/bit-fill-mode.jsx';
import BitEraserMode from '../../containers/bit-eraser-mode.jsx';
import BitSelectMode from '../../containers/bit-select-mode.jsx';
import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import ButtonGroup from '../button-group/button-group.jsx';
import BrushMode from '../../containers/brush-mode.jsx';
import EraserMode from '../../containers/eraser-mode.jsx';
import FillColorIndicatorComponent from '../../containers/fill-color-indicator.jsx';
import FillMode from '../../containers/fill-mode.jsx';
import InputGroup from '../input-group/input-group.jsx';
import Dropdown from '../dropdown/dropdown.jsx';
import LineMode from '../../containers/line-mode.jsx';
import Loupe from '../loupe/loupe.jsx';
import FixedToolsContainer from '../../containers/fixed-tools.jsx';
import ModeToolsContainer from '../../containers/mode-tools.jsx';
import OvalMode from '../../containers/oval-mode.jsx';
import PenMode from '../../containers/pen-mode.jsx';
import TriangleMode from '../../containers/triangle-mode.jsx';
import SussyMode from '../../containers/sussy-mode.jsx';
import ArrowMode from '../../containers/arrow-mode.jsx';
import ReshapeMode from '../../containers/reshape-mode.jsx';
import SelectMode from '../../containers/select-mode.jsx';
import EffectsMode from '../../containers/effects-mode.jsx';
import LayersBridge from '../../containers/layers-bridge.jsx';
import PreciseTransformMode from '../../containers/precise-transform-mode.jsx';
import PreciseTransformPanel from '../precise-transform-panel/precise-transform-panel.jsx';
import StrokeColorIndicatorComponent from '../../containers/stroke-color-indicator.jsx';
import StrokeToggleComponent from '../../containers/stroke-toggle.jsx';
import StrokeWidthIndicatorComponent from '../../containers/stroke-width-indicator.jsx';
import TextMode from '../../containers/text-mode.jsx';

import Formats, {isBitmap, isVector} from '../../lib/format';
import Modes from '../../lib/modes';
import layout from '../../lib/layout-constants';
import styles from './paint-editor.css';

import bitmapIcon from './icons/bitmap.svg';
import themeIcon from './icons/theme.svg';
import zoomInIcon from './icons/zoom-in.svg';
import zoomOutIcon from './icons/zoom-out.svg';
import zoomResetIcon from './icons/zoom-reset.svg';
import centerViewIcon from './icons/center-view.svg';

const messages = defineMessages({
    language: {defaultMessage: 'Switch language', description: 'Toggle app language', id: 'paint.paintEditor.language'},
    more: {
        defaultMessage: 'More',
        description: 'Label for the menu of compact tool controls',
        id: 'paint.paintEditor.more'
    },
    bitmap: {
        defaultMessage: 'Convert to Bitmap',
        description: 'Label for button that converts the paint editor to bitmap mode',
        id: 'paint.paintEditor.bitmap'
    },
    vector: {
        defaultMessage: 'Convert to Vector',
        description: 'Label for button that converts the paint editor to vector mode',
        id: 'paint.paintEditor.vector'
    },
    zoomOut: {
        defaultMessage: 'Zoom Out',
        description: 'Accessible label for the zoom out button',
        id: 'paint.paintEditor.zoomOut'
    },
    zoomReset: {
        defaultMessage: 'Zoom Reset',
        description: 'Accessible label for the reset zoom button',
        id: 'paint.paintEditor.zoomReset'
    },
    resetView: {
        defaultMessage: 'Center view',
        description: 'Accessible label for the button that centers the canvas view',
        id: 'paint.paintEditor.centerView'
    },
    zoomIn: {
        defaultMessage: 'Zoom In',
        description: 'Accessible label for the zoom in button',
        id: 'paint.paintEditor.zoomIn'
    },
    changeTheme: {
        defaultMessage: 'Change theme',
        description: 'Accessible label for the theme toggle button',
        id: 'paint.paintEditor.changeTheme'
    }
});

const PaintEditorComponent = props => {
    const intl = useIntl();
    const condensedTools = typeof window !== 'undefined' && window.innerWidth < layout.fullSizeEditorMinWidth;
    return (
        <div
            className={styles.editorContainer}
            data-precise-mode={props.mode === Modes.PRECISE_TRANSFORM ? 'true' : 'false'}
            data-paint-theme={props.theme}
            dir={props.rtl ? 'rtl' : 'ltr'}
        >
            <LayersBridge onUpdateImage={props.onUpdateImage}/>
            {props.canvas !== null ? ( // eslint-disable-line no-negated-condition
                <div className={styles.editorContainerTop}>
                    {/* First row */}
                    <div className={styles.row}>
                        <FixedToolsContainer
                            canRedo={props.canRedo}
                            canUndo={props.canUndo}
                            name={props.name}
                            onRedo={props.onRedo}
                            onUndo={props.onUndo}
                            onUpdateImage={props.onUpdateImage}
                            onUpdateName={props.onUpdateName}
                        />
                    </div>
                    {/* Second Row */}
                    {isVector(props.format) ?
                        <div className={styles.row}>
                            <InputGroup
                                className={classNames(
                                    styles.row,
                                    styles.modDashedBorder,
                                    styles.modLabeledIconHeight
                                )}
                            >
                                {/* fill */}
                                <FillColorIndicatorComponent
                                    className={styles.modMarginAfter}
                                    onUpdateImage={props.onUpdateImage}
                                />
                                {/* stroke */}
                                {condensedTools ? (
                                    <Dropdown
                                        className={styles.colorToolsMore}
                                        enterExitTransitionDurationMs={20}
                                        popoverContent={(
                                            <InputGroup className={styles.colorToolsMenu}>
                                                <StrokeToggleComponent onUpdateImage={props.onUpdateImage}/>
                                                <StrokeColorIndicatorComponent onUpdateImage={props.onUpdateImage}/>
                                                <StrokeWidthIndicatorComponent onUpdateImage={props.onUpdateImage}/>
                                            </InputGroup>
                                        )}
                                        tipSize={.01}
                                    >
                                        {intl.formatMessage(messages.more)}
                                    </Dropdown>
                                ) : (
                                    <>
                                        <StrokeToggleComponent onUpdateImage={props.onUpdateImage}/>
                                        <StrokeColorIndicatorComponent onUpdateImage={props.onUpdateImage}/>
                                        <StrokeWidthIndicatorComponent onUpdateImage={props.onUpdateImage}/>
                                    </>
                                )}
                            </InputGroup>
                            <InputGroup className={styles.modModeTools}>
                                <ModeToolsContainer
                                    onConvertTextToPaths={props.onConvertTextToPaths}
                                    onManageFonts={props.onManageFonts}
                                    onUpdateImage={props.onUpdateImage}
                                />
                            </InputGroup>
                        </div> :
                        isBitmap(props.format) ?
                            <div className={styles.row}>
                                <InputGroup
                                    className={classNames(
                                        styles.row,
                                        styles.modDashedBorder,
                                        styles.modLabeledIconHeight
                                    )}
                                >
                                    {/* fill */}
                                    <FillColorIndicatorComponent
                                        className={styles.modMarginAfter}
                                        onUpdateImage={props.onUpdateImage}
                                    />
                                </InputGroup>
                                <InputGroup className={styles.modModeTools}>
                                    <ModeToolsContainer
                                        onUpdateImage={props.onUpdateImage}
                                    />
                                </InputGroup>
                            </div> : null
                    }
                </div>
            ) : null}

            <div className={styles.topAlignRow}>
                {/* Modes */}
                {props.canvas !== null && isVector(props.format) ? (
                    <div className={styles.modeSelector}>
                        <SelectMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <EffectsMode/>
                        <PreciseTransformMode/>
                        <ReshapeMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <BrushMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <EraserMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <FillMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <TextMode
                            textArea={props.textArea}
                            onUpdateImage={props.onUpdateImage}
                        />
                        <LineMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <OvalMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <TriangleMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <SussyMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <ArrowMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <PenMode
                            onUpdateImage={props.onUpdateImage}
                        />
                    </div>
                ) : null}

                {props.canvas !== null && isBitmap(props.format) ? (
                    <div className={styles.modeSelector}>
                        <BitBrushMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <BitLineMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <BitOvalMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <BitRectMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <TextMode
                            isBitmap
                            textArea={props.textArea}
                            onUpdateImage={props.onUpdateImage}
                        />
                        <BitFillMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <BitEraserMode
                            onUpdateImage={props.onUpdateImage}
                        />
                        <BitSelectMode
                            onUpdateImage={props.onUpdateImage}
                        />
                    </div>
                ) : null}

                <div className={styles.controlsContainer}>
                    {/* Canvas */}
                    <ScrollableCanvas
                        canvas={props.canvas}
                        hideScrollbars={props.isEyeDropping}
                        style={styles.canvasContainer}
                    >
                        <PaperCanvas
                            canvasRef={props.setCanvas}
                            image={props.image}
                            imageFormat={props.imageFormat}
                            imageId={props.imageId}
                            rotationCenterX={props.rotationCenterX}
                            rotationCenterY={props.rotationCenterY}
                            theme={props.theme}
                            zoomLevelId={props.zoomLevelId}
                            onUpdateImage={props.onUpdateImage}
                        />
                        <textarea
                            className={styles.textArea}
                            ref={props.setTextArea}
                            spellCheck={false}
                        />
                        {props.isEyeDropping && props.colorInfo !== null ? (
                            <div className={styles.colorPickerWrapper}>
                                {!props.colorInfo.hideLoupe ? (
                                    <Loupe
                                        colorInfo={props.colorInfo}
                                        pixelRatio={paper.project.view.pixelRatio}
                                    />
                                ) : null}
                            </div>
                        ) : null}
                    </ScrollableCanvas>
                    {props.mode === Modes.PRECISE_TRANSFORM && isVector(props.format) ? (
                        <PreciseTransformPanel onUpdateImage={props.onUpdateImage}/>
                    ) : null}
                    <div className={styles.canvasControls}>
                        {isVector(props.format) ?
                            <Button
                                className={styles.bitmapButton}
                                onClick={props.onSwitchToBitmap}
                            >
                                <img
                                    className={styles.bitmapButtonIcon}
                                    draggable={false}
                                    src={bitmapIcon}
                                />
                                <span className={styles.buttonText}>
                                    {intl.formatMessage(messages.bitmap)}
                                </span>
                            </Button> :
                            isBitmap(props.format) ?
                                <Button
                                    className={styles.bitmapButton}
                                    onClick={props.onSwitchToVector}
                                >
                                    <img
                                        className={styles.bitmapButtonIcon}
                                        draggable={false}
                                        src={bitmapIcon}
                                    />
                                    <span className={styles.buttonText}>
                                        {intl.formatMessage(messages.vector)}
                                    </span>
                                </Button> : null
                        }
                        {/* Zoom controls */}
                        <InputGroup className={styles.zoomControls}>
                            <ButtonGroup>
                                <Button
                                    className={styles.buttonGroupButton}
                                    onClick={props.onResetView}
                                    title={intl.formatMessage(messages.resetView)}
                                >
                                    <img
                                        alt={intl.formatMessage(messages.resetView)}
                                        className={styles.buttonGroupButtonIcon}
                                        draggable={false}
                                        src={centerViewIcon}
                                    />
                                </Button>
                                <Button
                                    className={styles.buttonGroupButton}
                                    onClick={props.onZoomOut}
                                >
                                    <img
                                        alt={intl.formatMessage(messages.zoomOut)}
                                        className={styles.buttonGroupButtonIcon}
                                        draggable={false}
                                        src={zoomOutIcon}
                                    />
                                </Button>
                                <Button
                                    className={styles.buttonGroupButton}
                                    onClick={props.onZoomReset}
                                >
                                    <img
                                        alt={intl.formatMessage(messages.zoomReset)}
                                        className={styles.buttonGroupButtonIcon}
                                        draggable={false}
                                        src={zoomResetIcon}
                                    />
                                </Button>
                                <Button
                                    className={styles.buttonGroupButton}
                                    onClick={props.onZoomIn}
                                >
                                    <img
                                        alt={intl.formatMessage(messages.zoomIn)}
                                        className={styles.buttonGroupButtonIcon}
                                        draggable={false}
                                        src={zoomInIcon}
                                    />
                                </Button>
                            </ButtonGroup>
                            <ButtonGroup>
                                <Button
                                    aria-label={intl.formatMessage(messages.changeTheme)}
                                    className={styles.buttonGroupButton}
                                    onClick={props.onChangeTheme}
                                    title={intl.formatMessage(messages.changeTheme)}
                                >
                                    <img
                                        alt=""
                                        className={styles.buttonGroupButtonIcon}
                                        draggable={false}
                                        src={themeIcon}
                                    />
                                </Button>
                            </ButtonGroup>
                            <ButtonGroup>
                                <Button
                                    aria-label={intl.formatMessage(messages.language)}
                                    className={styles.buttonGroupButton}
                                    onClick={props.onToggleLanguage}
                                    title={intl.formatMessage(messages.language)}
                                >
                                    <span className={styles.languageButtonText}>
                                        {props.activeLocale === 'ja' ? 'EN' : 'JA'}
                                    </span>
                                </Button>
                            </ButtonGroup>
                        </InputGroup>
                    </div>
                </div>
            </div>
        </div>
    );
};

PaintEditorComponent.propTypes = {
    canRedo: PropTypes.func.isRequired,
    canUndo: PropTypes.func.isRequired,
    canvas: PropTypes.instanceOf(Element),
    colorInfo: Loupe.propTypes.colorInfo,
    format: PropTypes.oneOf(Object.keys(Formats)),
    image: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.instanceOf(HTMLImageElement)
    ]),
    imageFormat: PropTypes.string,
    imageId: PropTypes.string,
    isEyeDropping: PropTypes.bool,
    mode: PropTypes.oneOf(Object.keys(Modes)).isRequired,
    name: PropTypes.string,
    onChangeTheme: PropTypes.func.isRequired,
    onManageFonts: PropTypes.func,
    onConvertTextToPaths: PropTypes.func,
    activeLocale: PropTypes.string.isRequired,
    onToggleLanguage: PropTypes.func.isRequired,
    onRedo: PropTypes.func.isRequired,
    onResetView: PropTypes.func.isRequired,
    onSwitchToBitmap: PropTypes.func.isRequired,
    onSwitchToVector: PropTypes.func.isRequired,
    onUndo: PropTypes.func.isRequired,
    onUpdateImage: PropTypes.func.isRequired,
    onUpdateName: PropTypes.func.isRequired,
    onZoomIn: PropTypes.func.isRequired,
    onZoomOut: PropTypes.func.isRequired,
    onZoomReset: PropTypes.func.isRequired,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    rtl: PropTypes.bool,
    setCanvas: PropTypes.func.isRequired,
    setTextArea: PropTypes.func.isRequired,
    textArea: PropTypes.instanceOf(Element),
    theme: PropTypes.string,
    zoomLevelId: PropTypes.string
};

export default PaintEditorComponent;
