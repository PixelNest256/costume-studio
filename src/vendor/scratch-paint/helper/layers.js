import paper from '@scratch/paper';

const PROJECT_DATA_KEY = 'costumeStudioLayers';
const ACTIVE_LAYER_KEY = 'costumeStudioActiveLayerId';
const INACTIVE_DISPLAY_KEY = 'costumeStudioInactiveDisplay';
const DEFAULT_LAYER_ID = 'layer-1';
const INACTIVE_OPACITY = 0.35;
const basePresentation = new WeakMap();
let nextLayerNumber = 2;
let hoveredLayerId = null;
let hoverGuide = null;

const getPaintingLayer = () => (
    paper.project.layers.find(layer => layer.data && layer.data.isPaintingLayer)
);

export const getInactiveDisplay = () => {
    const mode = getProjectData()[INACTIVE_DISPLAY_KEY];
    return mode === 'opaque' || mode === 'hidden' ? mode : 'dim';
};

const getProjectData = () => {
    if (!paper.project.data) paper.project.data = {};
    return paper.project.data;
};

const getRootInPaintingLayer = item => {
    const paintingLayer = getPaintingLayer();
    if (!item || !paintingLayer) return null;
    let current = item;
    while (current && current.parent && current.parent !== paintingLayer) {
        current = current.parent;
    }
    return current && current.parent === paintingLayer ? current : null;
};

const getLayerRootItems = () => {
    const layer = getPaintingLayer();
    if (!layer) return [];
    return layer.children.filter(child =>
        !(child.data && child.data.isHelperItem) &&
        !child.locked &&
        !child.isClipMask());
};

const makeLayer = (id, name) => ({id, name, visible: true});

const ensureRegistry = () => {
    const projectData = getProjectData();
    let registry = projectData[PROJECT_DATA_KEY];
    if (!Array.isArray(registry) || registry.length === 0) {
        registry = [makeLayer(DEFAULT_LAYER_ID, 'Layer 1')];
        projectData[PROJECT_DATA_KEY] = registry;
    }
    let changed = false;
    const seen = new Set();
    for (const layer of registry) {
        if (!layer.id || seen.has(layer.id)) {
            changed = true;
            continue;
        }
        seen.add(layer.id);
    }
    if (changed) {
        registry = registry.filter(layer => layer.id && seen.has(layer.id));
        if (!registry.length) registry.push(makeLayer(DEFAULT_LAYER_ID, 'Layer 1'));
        projectData[PROJECT_DATA_KEY] = registry;
    }
    let active = projectData[ACTIVE_LAYER_KEY];
    if (!active || !registry.some(layer => layer.id === active)) {
        active = registry[registry.length - 1].id;
        projectData[ACTIVE_LAYER_KEY] = active;
    }
    return {registry, active};
};

export const ensureItemLayers = () => {
    const {registry, active} = ensureRegistry();
    const valid = new Set(registry.map(layer => layer.id));
    for (const item of getLayerRootItems()) {
        if (!item.data) item.data = {};
        if (!item.data.layerId || !valid.has(item.data.layerId)) {
            item.data.layerId = active;
        }
    }
};

export const getLayersState = () => {
    ensureItemLayers();
    const {registry, active} = ensureRegistry();
    return {
        activeLayerId: active,
        inactiveDisplay: getInactiveDisplay(),
        layers: registry.map(layer => ({
            ...layer,
            itemCount: getLayerRootItems().filter(item =>
                item.data && item.data.layerId === layer.id).length
        }))
    };
};

export const getActiveLayerId = () => ensureRegistry().active;

export const getItemLayerId = item => {
    ensureItemLayers();
    const root = getRootInPaintingLayer(item);
    return root && root.data ? root.data.layerId : null;
};

export const isItemInActiveLayer = item => {
    if (!item || !item.layer || !item.layer.data || !item.layer.data.isPaintingLayer) {
        return true; // helpers, guides, raster/background
    }
    ensureItemLayers();
    const root = getRootInPaintingLayer(item);
    return Boolean(root && root.data && root.data.layerId === getActiveLayerId());
};

const rememberBase = item => {
    if (!basePresentation.has(item)) {
        basePresentation.set(item, {opacity: item.opacity, visible: item.visible});
    }
    return basePresentation.get(item);
};

const renderHoverGuide = () => {
    if (hoverGuide) {
        hoverGuide.remove();
        hoverGuide = null;
    }
    if (!hoveredLayerId) return;
    const guideLayer = paper.project.layers.find(layer =>
        layer.data && layer.data.isGuideLayer);
    if (!guideLayer) return;
    const items = getLayerRootItems().filter(item =>
        item.data && item.data.layerId === hoveredLayerId);
    if (!items.length) return;
    let bounds = null;
    for (const item of items) {
        bounds = bounds ? bounds.unite(item.bounds) : item.bounds;
    }
    if (!bounds || !bounds.width || !bounds.height) return;
    const guide = new paper.Path.Rectangle(bounds.expand(4 / paper.view.zoom));
    guide.strokeColor = '#855cd6';
    guide.strokeWidth = 1.5 / paper.view.zoom;
    guide.dashArray = [5 / paper.view.zoom, 3 / paper.view.zoom];
    guide.fillColor = null;
    guide.guide = true;
    guide.data = {isHelperItem: true, isLayerHoverGuide: true};
    guideLayer.addChild(guide);
    guide.bringToFront();
    hoverGuide = guide;
};

export const applyLayerPresentation = () => {
    ensureItemLayers();
    const {registry, active} = ensureRegistry();
    const byId = new Map(registry.map(layer => [layer.id, layer]));
    const inactiveDisplay = getInactiveDisplay();
    for (const item of getLayerRootItems()) {
        const base = rememberBase(item);
        const layer = byId.get(item.data.layerId);
        if (!layer) continue;
        if (layer.visible === false) {
            item.visible = false;
            item.opacity = base.opacity;
            continue;
        }
        let opacityScale;
        let visible = base.visible;
        if (layer.id === active) {
            opacityScale = 1;
        } else if (layer.id === hoveredLayerId) {
            opacityScale = 1;
        } else if (inactiveDisplay === 'opaque') {
            opacityScale = 1;
        } else if (inactiveDisplay === 'hidden') {
            opacityScale = 0;
            visible = false;
        } else {
            opacityScale = INACTIVE_OPACITY;
        }
        item.visible = visible;
        item.opacity = base.opacity * opacityScale;
    }
    renderHoverGuide();
};

export const setHoveredLayer = id => {
    ensureItemLayers();
    const {registry} = ensureRegistry();
    hoveredLayerId = registry.some(layer => layer.id === id) ? id : null;
    applyLayerPresentation();
};

export const setInactiveDisplay = mode => {
    if (mode !== 'opaque' && mode !== 'dim' && mode !== 'hidden') return false;
    getProjectData()[INACTIVE_DISPLAY_KEY] = mode;
    applyLayerPresentation();
    return true;
};

export const prepareLayerPresentation = () => {
    ensureItemLayers();
    const {registry} = ensureRegistry();
    const byId = new Map(registry.map(layer => [layer.id, layer]));
    for (const item of getLayerRootItems()) {
        const base = rememberBase(item);
        const layer = byId.get(item.data.layerId);
        item.opacity = base.opacity;
        item.visible = layer && layer.visible === false ? false : base.visible;
    }
};

export const restoreLayerPresentation = () => {
    applyLayerPresentation();
};

export const deselectInactiveItems = () => {
    for (const item of paper.project.selectedItems.slice()) {
        if (!isItemInActiveLayer(item)) {
            item.selected = false;
            item.fullySelected = false;
        }
    }
};

export const normalizeLayerOrder = () => {
    ensureItemLayers();
    const {registry} = ensureRegistry();
    const items = getLayerRootItems();
    if (!items.length) return;
    const byLayer = new Map(registry.map(layer => [layer.id, []]));
    const extras = [];
    for (const item of items) {
        const list = byLayer.get(item.data.layerId);
        if (list) list.push(item);
        else extras.push(item);
    }
    const ordered = [];
    for (const layer of registry) ordered.push(...byLayer.get(layer.id));
    ordered.push(...extras);
    if (!ordered.length) return;
    ordered[0].sendToBack();
    for (let i = 1; i < ordered.length; i++) {
        ordered[i].insertAbove(ordered[i - 1]);
    }
};

const deselectAll = () => {
    for (const item of paper.project.selectedItems.slice()) {
        item.selected = false;
        item.fullySelected = false;
    }
};

export const setActiveLayer = id => {
    const {registry} = ensureRegistry();
    if (!registry.some(layer => layer.id === id)) return false;
    getProjectData()[ACTIVE_LAYER_KEY] = id;
    deselectAll();
    applyLayerPresentation();
    normalizeLayerOrder();
    return true;
};

export const addLayer = () => {
    const {registry, active} = ensureRegistry();
    const id = `layer-${Date.now().toString(36)}-${nextLayerNumber++}`;
    const index = Math.max(0, registry.findIndex(layer => layer.id === active));
    registry.splice(index + 1, 0, makeLayer(id, `Layer ${registry.length + 1}`));
    getProjectData()[ACTIVE_LAYER_KEY] = id;
    applyLayerPresentation();
    normalizeLayerOrder();
    return id;
};

export const removeLayer = id => {
    const {registry, active} = ensureRegistry();
    if (registry.length <= 1) return false;
    const index = registry.findIndex(layer => layer.id === id);
    if (index === -1) return false;
    const target = registry[index === registry.length - 1 ? index - 1 : index + 1];
    // Deleting a layer also removes its objects. Undo still restores both
    // because layer state and artwork are captured in the same snapshot.
    for (const item of getLayerRootItems()) {
        if (item.data && item.data.layerId === id) item.remove();
    }
    registry.splice(index, 1);
    if (active === id) getProjectData()[ACTIVE_LAYER_KEY] = target.id;
    applyLayerPresentation();
    normalizeLayerOrder();
    return true;
};

export const renameLayer = (id, name) => {
    const {registry} = ensureRegistry();
    const layer = registry.find(entry => entry.id === id);
    if (!layer) return false;
    layer.name = String(name || '').trim() || layer.name;
    return true;
};

export const setLayerVisible = (id, visible) => {
    const {registry} = ensureRegistry();
    const layer = registry.find(entry => entry.id === id);
    if (!layer) return false;
    layer.visible = Boolean(visible);
    if (!layer.visible && id === getProjectData()[ACTIVE_LAYER_KEY]) {
        const fallback = registry.find(entry => entry.id !== id && entry.visible !== false);
        if (fallback) {
            getProjectData()[ACTIVE_LAYER_KEY] = fallback.id;
            deselectAll();
        }
    }
    applyLayerPresentation();
    return true;
};

export const reorderLayers = ids => {
    const {registry} = ensureRegistry();
    if (!Array.isArray(ids) || ids.length !== registry.length) return false;
    const byId = new Map(registry.map(layer => [layer.id, layer]));
    if (ids.some(id => !byId.has(id))) return false;
    getProjectData()[PROJECT_DATA_KEY] = ids.map(id => byId.get(id));
    normalizeLayerOrder();
    return true;
};

export const moveLayer = (id, direction) => {
    const {registry} = ensureRegistry();
    const index = registry.findIndex(layer => layer.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= registry.length) return false;
    const [layer] = registry.splice(index, 1);
    registry.splice(target, 0, layer);
    normalizeLayerOrder();
    return true;
};

export const moveSelectionToLayer = layerId => {
    const {registry} = ensureRegistry();
    if (!registry.some(layer => layer.id === layerId)) return false;
    const items = paper.project.selectedItems.slice();
    let changed = false;
    for (const item of items) {
        const root = getRootInPaintingLayer(item);
        if (!root) continue;
        if (!root.data) root.data = {};
        if (root.data.layerId !== layerId) {
            root.data.layerId = layerId;
            changed = true;
        }
    }
    ensureItemLayers();
    applyLayerPresentation();
    normalizeLayerOrder();
    return changed;
};

export const moveSelectionToActiveLayer = () => moveSelectionToLayer(getActiveLayerId());

export const attachLayersToSvg = svg => {
    try {
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = document.documentElement;
        if (!root || document.querySelector('parsererror')) return svg;
        const {registry, active} = ensureRegistry();
        root.setAttribute('data-costume-studio-layers', JSON.stringify({
            activeLayerId: active,
            inactiveDisplay: getInactiveDisplay(),
            layers: registry
        }));
        return new XMLSerializer().serializeToString(root);
    } catch (error) {
        return svg;
    }
};

export const readLayersFromSvg = svg => {
    try {
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = document.documentElement;
        if (!root || document.querySelector('parsererror')) return false;
        const raw = root.getAttribute('data-costume-studio-layers');
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.layers) || !data.layers.length) return false;
        const layers = data.layers
            .filter(layer => layer && layer.id)
            .map(layer => ({
                id: String(layer.id),
                name: String(layer.name || 'Layer'),
                visible: layer.visible !== false
            }));
        if (!layers.length) return false;
        const projectData = getProjectData();
        projectData[PROJECT_DATA_KEY] = layers;
        if (data.inactiveDisplay === 'opaque' || data.inactiveDisplay === 'hidden' ||
                data.inactiveDisplay === 'dim') {
            projectData[INACTIVE_DISPLAY_KEY] = data.inactiveDisplay;
        }
        const active = layers.some(layer => layer.id === data.activeLayerId) ?
            data.activeLayerId :
            layers[layers.length - 1].id;
        projectData[ACTIVE_LAYER_KEY] = active;
        return true;
    } catch (error) {
        return false;
    }
};

export const getLayersSnapshot = () => {
    const {registry, active} = ensureRegistry();
    return {
        activeLayerId: active,
        inactiveDisplay: getInactiveDisplay(),
        layers: registry.map(layer => ({...layer}))
    };
};

export const restoreLayersSnapshot = snapshot => {
    if (!snapshot || !Array.isArray(snapshot.layers) || !snapshot.layers.length) return false;
    const layers = snapshot.layers
        .filter(layer => layer && layer.id)
        .map(layer => ({
            id: String(layer.id),
            name: String(layer.name || 'Layer'),
            visible: layer.visible !== false
        }));
    if (!layers.length) return false;
    const projectData = getProjectData();
    projectData[PROJECT_DATA_KEY] = layers;
    projectData[ACTIVE_LAYER_KEY] = layers.some(layer => layer.id === snapshot.activeLayerId) ?
        snapshot.activeLayerId :
        layers[layers.length - 1].id;
    if (snapshot.inactiveDisplay === 'opaque' || snapshot.inactiveDisplay === 'hidden' ||
            snapshot.inactiveDisplay === 'dim') {
        projectData[INACTIVE_DISPLAY_KEY] = snapshot.inactiveDisplay;
    }
    return true;
};

export const getLayerItems = layerId => {
    ensureItemLayers();
    return getLayerRootItems().filter(item =>
        item.data && item.data.layerId === layerId);
};
