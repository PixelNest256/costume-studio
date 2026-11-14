import paper from '@scratch/paper';
import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {setSelectedItems} from '../reducers/selected-items';
import {getSelectedLeafItems} from '../helper/selection';
import {
    addLayer,
    applyLayerPresentation,
    deselectInactiveItems,
    ensureItemLayers,
    getActiveLayerId,
    getLayersState,
    moveLayer,
    moveSelectionToActiveLayer,
    moveSelectionToLayer,
    setHoveredLayer,
    setInactiveDisplay,
    normalizeLayerOrder,
    removeLayer,
    reorderLayers,
    renameLayer,
    setActiveLayer,
    setLayerVisible
} from '../helper/layers';

class LayersBridge extends React.Component {
    constructor (props) {
        super(props);
        this.handleAction = this.handleAction.bind(this);
        this.handleHover = this.handleHover.bind(this);
        this.handleRequest = this.handleRequest.bind(this);
        this.publish = this.publish.bind(this);
    }
    componentDidMount () {
        window.addEventListener('costume-studio:layers-request', this.handleRequest);
        window.addEventListener('costume-studio:layers-action', this.handleAction);
        window.addEventListener('costume-studio:layers-hover', this.handleHover);
        this.initialize();
        this.interval = window.setInterval(this.publish, 900);
    }
    componentWillUnmount () {
        window.removeEventListener('costume-studio:layers-request', this.handleRequest);
        window.removeEventListener('costume-studio:layers-action', this.handleAction);
        window.removeEventListener('costume-studio:layers-hover', this.handleHover);
        window.clearInterval(this.interval);
        window.clearTimeout(this.initTimer);
        if (paper.project) setHoveredLayer(null);
    }
    initialize () {
        if (!paper.project) {
            this.initTimer = window.setTimeout(() => this.initialize(), 100);
            return;
        }
        ensureItemLayers();
        normalizeLayerOrder();
        applyLayerPresentation();
        deselectInactiveItems();
        this.publish();
    }
    handleRequest () {
        this.publish();
    }
    handleHover (event) {
        if (!paper.project) return;
        setHoveredLayer(event.detail ? event.detail.id : null);
    }
    publish () {
        if (!paper.project) return;
        ensureItemLayers();
        normalizeLayerOrder();
        applyLayerPresentation();
        deselectInactiveItems();
        window.dispatchEvent(new CustomEvent('costume-studio:layers-state', {
            detail: getLayersState()
        }));
    }
    refreshSelection () {
        this.props.setSelectedItems();
    }
    handleAction (event) {
        if (!paper.project) return;
        const detail = event.detail || {};
        let changed = false;
        switch (detail.type) {
        case 'add':
            addLayer();
            paper.project.deselectAll();
            this.refreshSelection();
            changed = true;
            break;
        case 'remove':
            changed = removeLayer(detail.id);
            this.refreshSelection();
            break;
        case 'rename':
            changed = renameLayer(detail.id, detail.name);
            break;
        case 'visible':
            setLayerVisible(detail.id, detail.visible);
            if (!detail.visible && detail.id === getActiveLayerId()) {
                paper.project.deselectAll();
            }
            this.refreshSelection();
            changed = true;
            break;
        case 'active':
            if (setActiveLayer(detail.id)) {
                this.refreshSelection();
                changed = true;
            }
            break;
        case 'move-layer':
            changed = moveLayer(detail.id, detail.direction);
            break;
        case 'reorder':
            changed = reorderLayers(detail.ids);
            break;
        case 'move-selection':
            changed = moveSelectionToActiveLayer();
            this.refreshSelection();
            break;
        case 'move-selection-to':
            changed = moveSelectionToLayer(detail.id);
            this.refreshSelection();
            break;
        case 'inactive-display':
            changed = setInactiveDisplay(detail.mode);
            break;
        default:
            break;
        }
        if (changed) this.props.onUpdateImage();
        this.publish();
    }
    render () {
        return null;
    }
}

LayersBridge.propTypes = {
    onUpdateImage: PropTypes.func.isRequired,
    setSelectedItems: PropTypes.func.isRequired
};

const mapDispatchToProps = dispatch => ({
    setSelectedItems: () => {
        dispatch(setSelectedItems(getSelectedLeafItems(), false));
    }
});

export default connect(null, mapDispatchToProps)(LayersBridge);
