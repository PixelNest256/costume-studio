import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import FixedToolsComponent from '../components/fixed-tools/fixed-tools.jsx';

import {changeMode} from '../reducers/modes';
import {changeFormat} from '../reducers/format';
import {clearSelectedItems, setSelectedItems} from '../reducers/selected-items';
import {deactivateEyeDropper} from '../reducers/eye-dropper';
import {setTextEditTarget} from '../reducers/text-edit-target';
import {setLayout} from '../reducers/layout';

import paper from '@scratch/paper';
import {getSelectedLeafItems, getSelectedRootItems} from '../helper/selection';
import {bringToFront, sendBackward, sendToBack, bringForward} from '../helper/order';
import {groupSelection, ungroupSelection} from '../helper/group';
import {getRaster, clearRaster} from '../helper/layer';
import {getHitBounds} from '../helper/bitmap';
import {isBitmap as isBitmapFormat} from '../lib/format';

import Formats, {isBitmap} from '../lib/format';
import bindAll from 'lodash.bindall';

class FixedTools extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleSendBackward',
            'handleSendForward',
            'handleSendToBack',
            'handleSendToFront',
            'handleSetSelectedItems',
            'handleGroup',
            'handleUngroup',
            'handleCrop'
        ]);
    }
    handleGroup () {
        groupSelection(this.props.clearSelectedItems, this.handleSetSelectedItems, this.props.onUpdateImage);
    }
    handleUngroup () {
        ungroupSelection(this.props.clearSelectedItems, this.handleSetSelectedItems, this.props.onUpdateImage);
    }
    handleSendBackward () {
        sendBackward(this.props.onUpdateImage);
    }
    handleSendForward () {
        bringForward(this.props.onUpdateImage);
    }
    handleSendToBack () {
        sendToBack(this.props.onUpdateImage);
    }
    handleSendToFront () {
        bringToFront(this.props.onUpdateImage);
    }
    handleSetSelectedItems () {
        this.props.setSelectedItems(this.props.format);
    }
    handleCrop () {
        // Image crop (画像剪断): keep only the selected content.
        // Vector: delete everything except the current selection.
        // Bitmap: trim transparent edges (same hit-bounds logic as copy/trim in helper/bitmap).
        if (isBitmapFormat(this.props.format)) {
            const raster = getRaster();
            const bounds = getHitBounds(raster);
            if (!bounds || !bounds.width || !bounds.height) return;
            const sub = raster.getSubRaster(bounds);
            const canvas = sub.canvas;
            clearRaster();
            const fresh = getRaster();
            const ctx = fresh.canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            const x = Math.round((fresh.canvas.width - canvas.width) / 2);
            const y = Math.round((fresh.canvas.height - canvas.height) / 2);
            ctx.drawImage(canvas, x, y);
            sub.remove();
            this.props.clearSelectedItems();
            this.props.onUpdateImage();
            return;
        }
        const selected = getSelectedRootItems();
        if (selected.length === 0) return;
        const layer = paper.project.activeLayer;
        const keep = new Set(selected.map(item => item.id));
        for (let i = layer.children.length - 1; i >= 0; i--) {
            const item = layer.children[i];
            if (item.data && (item.data.isHelperItem || item.data.isBackgroundGuideLayer)) continue;
            if (!keep.has(item.id) && !selected.some(sel => sel === item || sel.contains(item))) {
                item.remove();
            }
        }
        this.props.clearSelectedItems();
        this.props.onUpdateImage();
    }
    render () {
        return (
            <FixedToolsComponent
                canRedo={this.props.canRedo}
                canUndo={this.props.canUndo}
                name={this.props.name}
                onCrop={this.handleCrop}
                onGroup={this.handleGroup}
                onRedo={this.props.onRedo}
                onSendBackward={this.handleSendBackward}
                onSendForward={this.handleSendForward}
                onSendToBack={this.handleSendToBack}
                onSendToFront={this.handleSendToFront}
                onUndo={this.props.onUndo}
                onUngroup={this.handleUngroup}
                onUpdateImage={this.props.onUpdateImage}
                onUpdateName={this.props.onUpdateName}
            />
        );
    }
}

FixedTools.propTypes = {
    canRedo: PropTypes.func.isRequired,
    canUndo: PropTypes.func.isRequired,
    clearSelectedItems: PropTypes.func.isRequired,
    format: PropTypes.oneOf(Object.keys(Formats)),
    name: PropTypes.string,
    onRedo: PropTypes.func.isRequired,
    onUndo: PropTypes.func.isRequired,
    onUpdateImage: PropTypes.func.isRequired,
    onUpdateName: PropTypes.func.isRequired,
    setSelectedItems: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    changeColorToEyeDropper: state.scratchPaint.color.eyeDropper.callback,
    format: state.scratchPaint.format,
    isEyeDropping: state.scratchPaint.color.eyeDropper.active,
    mode: state.scratchPaint.mode,
    pasteOffset: state.scratchPaint.clipboard.pasteOffset,
    previousTool: state.scratchPaint.color.eyeDropper.previousTool,
    selectedItems: state.scratchPaint.selectedItems,
    viewBounds: state.scratchPaint.viewBounds
});
const mapDispatchToProps = dispatch => ({
    changeMode: mode => {
        dispatch(changeMode(mode));
    },
    clearSelectedItems: () => {
        dispatch(clearSelectedItems());
    },
    handleSwitchToBitmap: () => {
        dispatch(changeFormat(Formats.BITMAP));
    },
    handleSwitchToVector: () => {
        dispatch(changeFormat(Formats.VECTOR));
    },
    removeTextEditTarget: () => {
        dispatch(setTextEditTarget());
    },
    setLayout: layout => {
        dispatch(setLayout(layout));
    },
    setSelectedItems: format => {
        dispatch(setSelectedItems(getSelectedLeafItems(), isBitmap(format)));
    },
    onDeactivateEyeDropper: () => {
        // set redux values to default for eye dropper reducer
        dispatch(deactivateEyeDropper());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(FixedTools);
