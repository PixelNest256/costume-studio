export const SNAP_THRESHOLD = 10;
export const SNAP_GUIDE_COLOR = '#ff0000';

// Snap settings are stored by the app's Features menu. Defaults correspond to
// the documented initial paint-snap targets; per-addon code is not used.
export const SNAP_DEFAULTS = {
    snap: true,
    snapPageCenter: true,
    snapPageAxes: true,
    snapPageEdges: true,
    snapPageCorners: false,
    snapObjectEdges: true,
    snapObjectCenters: true,
    snapObjectMidlines: true,
    snapObjectCorners: false,
    snapBoxCenter: true,
    snapBoxCorners: false,
    snapBoxEdgeMids: false,
    snapCtrlDisable: true,
    snapTextToPath: false
};

export const loadSnapSettings = () => {
    const settings = {...SNAP_DEFAULTS};
    try {
        const raw = window.localStorage.getItem('costume-studio.features.v1');
        if (raw) {
            const data = JSON.parse(raw);
            if (data && data.enabled) {
                for (const key of Object.keys(SNAP_DEFAULTS)) {
                    if (typeof data.enabled[key] === 'boolean') settings[key] = data.enabled[key];
                }
            }
        }
    } catch (error) {
        // ignore malformed or unavailable storage
    }
    return settings;
};
