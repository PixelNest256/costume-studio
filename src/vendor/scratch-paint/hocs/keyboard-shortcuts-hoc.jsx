import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import omit from 'lodash.omit';
import {connect} from 'react-redux';

import CopyPasteHOC from './copy-paste-hoc.jsx';

import {selectAllBitmap} from '../helper/bitmap';
import {clearSelection, deleteSelection, getSelectedLeafItems,
    selectAllItems, selectAllSegments, getSelectedRootItems} from '../helper/selection';
import {groupSelection, shouldShowGroup, ungroupSelection, shouldShowUngroup} from '../helper/group';
import {clearSelectedItems, setSelectedItems} from '../reducers/selected-items';
import {changeMode} from '../reducers/modes';

import Formats, {isBitmap, isVector} from '../lib/format';
import Modes from '../lib/modes';

// Single-letter tool bindings implemented for this editor. The chosen letters
// follow familiar paint-editor conventions; extra tools use otherwise unused keys.
const VECTOR_KEYBINDINGS = {
    s: Modes.SELECT,
    a: Modes.RESHAPE,
    b: Modes.BRUSH,
    e: Modes.ERASER,
    f: Modes.FILL,
    t: Modes.TEXT,
    l: Modes.LINE,
    c: Modes.OVAL,
    r: Modes.RECT,
    p: Modes.PEN,
    y: Modes.TRIANGLE,
    v: Modes.ARROW,
    m: Modes.SUSSY
};

const BITMAP_KEYBINDINGS = {
    b: Modes.BIT_BRUSH,
    l: Modes.BIT_LINE,
    c: Modes.BIT_OVAL,
    r: Modes.BIT_RECT,
    t: Modes.BIT_TEXT,
    f: Modes.BIT_FILL,
    e: Modes.BIT_ERASER,
    s: Modes.BIT_SELECT
};

const KeyboardShortcutsHOC = function (WrappedComponent) {
    class KeyboardShortcutsWrapper extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleKeyPress',
                'changeToASelectMode',
                'selectAll'
            ]);
        }
        handleKeyPress (event) {
            if (event.target instanceof HTMLInputElement ||
                event.target.isContentEditable ||
                (event.target.closest && event.target.closest('.cm-content, .svg-code-editor'))) {
                // Ignore keyboard shortcuts if a text input field or the
                // SVG code editor is focused (letter keys would otherwise
                // switch tools while typing code).
                return;
            }
            // Don't activate keyboard shortcuts during text editing
            if (this.props.textEditing) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                clearSelection(this.props.clearSelectedItems);
            } else if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                if (deleteSelection(this.props.mode, this.props.onUpdateImage)) {
                    this.props.setSelectedItems(this.props.format);
                }
            } else if (event.metaKey || event.ctrlKey) {
                const key = event.key.toLowerCase();
                if (event.shiftKey && key === 'z') {
                    event.preventDefault();
                    this.props.onRedo();
                } else if (key === 'z') {
                    event.preventDefault();
                    this.props.onUndo();
                } else if (event.shiftKey && key === 'g') {
                    if (shouldShowUngroup()) {
                        ungroupSelection(clearSelectedItems, setSelectedItems, this.props.onUpdateImage);
                    }
                    event.preventDefault();
                } else if (key === 'g') {
                    if (shouldShowGroup()) {
                        groupSelection(clearSelectedItems, setSelectedItems, this.props.onUpdateImage);
                    }
                    event.preventDefault();
                } else if (key === 'c') {
                    event.preventDefault();
                    this.props.onCopyToClipboard();
                } else if (key === 'v') {
                    event.preventDefault();
                    this.changeToASelectMode();
                    this.props.onPasteFromClipboard();
                } else if (key === 'x') {
                    const selectedItems = getSelectedRootItems();
                    if (selectedItems.length > 0) {
                        this.props.onCopyToClipboard();
                        if (deleteSelection(this.props.mode, this.props.onUpdateImage)) {
                            this.props.setSelectedItems(this.props.format);
                        }
                    }
                    event.preventDefault();
                } else if (event.key === 'a') {
                    this.changeToASelectMode();
                    event.preventDefault();
                    this.selectAll();
                }
            } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
                // Single-letter tool shortcuts used by this app.
                if (isVector(this.props.format) &&
                    Object.prototype.hasOwnProperty.call(VECTOR_KEYBINDINGS, event.key.toLowerCase())) {
                    event.preventDefault();
                    this.props.changeMode(VECTOR_KEYBINDINGS[event.key.toLowerCase()]);
                } else if (isBitmap(this.props.format) &&
                    Object.prototype.hasOwnProperty.call(BITMAP_KEYBINDINGS, event.key.toLowerCase())) {
                    event.preventDefault();
                    this.props.changeMode(BITMAP_KEYBINDINGS[event.key.toLowerCase()]);
                }
            }
        }
        changeToASelectMode () {
            if (isBitmap(this.props.format)) {
                if (this.props.mode !== Modes.BIT_SELECT) {
                    this.props.changeMode(Modes.BIT_SELECT);
                }
            } else if (this.props.mode !== Modes.SELECT &&
                this.props.mode !== Modes.PRECISE_TRANSFORM && this.props.mode !== Modes.RESHAPE) {
                this.props.changeMode(Modes.SELECT);
            }
        }
        selectAll () {
            if (isBitmap(this.props.format)) {
                selectAllBitmap(this.props.clearSelectedItems);
                this.props.setSelectedItems(this.props.format);
            } else if (this.props.mode === Modes.RESHAPE) {
                if (selectAllSegments()) this.props.setSelectedItems(this.props.format);
            } else if (selectAllItems()) {
                this.props.setSelectedItems(this.props.format);
            }
        }
        render () {
            const componentProps = omit(this.props, [
                'changeMode',
                'clearSelectedItems',
                'format',
                'mode',
                'onCopyToClipboard',
                'onPasteFromClipboard',
                'setSelectedItems',
                'textEditing']);
            return (
                <WrappedComponent
                    onKeyPress={this.handleKeyPress}
                    {...componentProps}
                />
            );
        }
    }

    KeyboardShortcutsWrapper.propTypes = {
        changeMode: PropTypes.func.isRequired,
        clearSelectedItems: PropTypes.func.isRequired,
        format: PropTypes.oneOf(Object.keys(Formats)),
        mode: PropTypes.oneOf(Object.keys(Modes)).isRequired,
        onCopyToClipboard: PropTypes.func.isRequired,
        onPasteFromClipboard: PropTypes.func.isRequired,
        onRedo: PropTypes.func.isRequired,
        onUndo: PropTypes.func.isRequired,
        onUpdateImage: PropTypes.func.isRequired,
        setSelectedItems: PropTypes.func.isRequired,
        textEditing: PropTypes.bool.isRequired
    };

    const mapStateToProps = state => ({
        mode: state.scratchPaint.mode,
        format: state.scratchPaint.format,
        textEditing: state.scratchPaint.textEditTarget !== null
    });
    const mapDispatchToProps = dispatch => ({
        changeMode: mode => {
            dispatch(changeMode(mode));
        },
        clearSelectedItems: () => {
            dispatch(clearSelectedItems());
        },
        setSelectedItems: format => {
            dispatch(setSelectedItems(getSelectedLeafItems(), isBitmap(format)));
        }
    });

    return CopyPasteHOC(connect(
        mapStateToProps,
        mapDispatchToProps
    )(KeyboardShortcutsWrapper));
};

export default KeyboardShortcutsHOC;
