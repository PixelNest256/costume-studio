export const FEATURES_STORAGE_KEY = 'costume-studio.features.v1';

// Editor-internal settings. The outer Features panel was removed because it
// duplicated the built-in editor tools; this menu only controls settings
// that have no dedicated control inside the editor (e.g. snapping).
// Snap sub-setting defaults are based on the documented page/object guide
// behavior of paint-snap; snapping itself is implemented in our vendored editor.
export const DEFAULT_FEATURES = {
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
    pasteNoOffset: true,
    autoBackup: true
};

export const FEATURE_GROUPS = [
    {
        id: 'snap',
        key: 'features.groupSnap',
        items: [
            ['snap', 'features.snap', 'features.snapHint'],
            ['snapCtrlDisable', 'features.snapCtrlDisable', 'features.snapCtrlDisableHint']
        ]
    },
    {
        id: 'snapTo',
        key: 'features.groupSnapTo',
        items: [
            ['snapPageCenter', 'features.snapPageCenter', ''],
            ['snapPageAxes', 'features.snapPageAxes', ''],
            ['snapPageEdges', 'features.snapPageEdges', ''],
            ['snapPageCorners', 'features.snapPageCorners', ''],
            ['snapObjectEdges', 'features.snapObjectEdges', ''],
            ['snapObjectCenters', 'features.snapObjectCenters', ''],
            ['snapObjectMidlines', 'features.snapObjectMidlines', ''],
            ['snapObjectCorners', 'features.snapObjectCorners', '']
        ]
    },
    {
        id: 'snapFrom',
        key: 'features.groupSnapFrom',
        items: [
            ['snapBoxCenter', 'features.snapBoxCenter', ''],
            ['snapBoxCorners', 'features.snapBoxCorners', ''],
            ['snapBoxEdgeMids', 'features.snapBoxEdgeMids', '']
        ]
    },
    {
        id: 'editor',
        key: 'features.groupEditor',
        items: [
            ['pasteNoOffset', 'features.pasteNoOffset', 'features.pasteNoOffsetHint']
        ]
    },
    {
        id: 'backup',
        key: 'features.groupBackup',
        items: [
            ['autoBackup', 'features.autoBackup', 'features.autoBackupHint']
        ]
    }
];

const isPlainObject = value => (value && typeof value === 'object' && !Array.isArray(value));

export const createDefaultState = () => ({
    enabled: {...DEFAULT_FEATURES}
});

export const loadFeatureState = () => {
    const fallback = createDefaultState();
    try {
        const raw = window.localStorage.getItem(FEATURES_STORAGE_KEY);
        if (!raw) return fallback;
        const data = JSON.parse(raw);
        if (!isPlainObject(data)) return fallback;
        const enabled = {...fallback.enabled};
        if (isPlainObject(data.enabled)) {
            for (const key of Object.keys(DEFAULT_FEATURES)) {
                if (typeof data.enabled[key] === 'boolean') enabled[key] = data.enabled[key];
            }
        }
        return {enabled};
    } catch (error) {
        return fallback;
    }
};

export const saveFeatureState = state => {
    try {
        window.localStorage.setItem(FEATURES_STORAGE_KEY, JSON.stringify(state));
        return {ok: true};
    } catch (error) {
        return {ok: false};
    }
};

// Read by vendor move-tool (paint-snap) on every drag, so the toggle takes
// effect without a reload. Defaults to on when unset.
export const isSnapEnabled = () => {
    try {
        const raw = window.localStorage.getItem(FEATURES_STORAGE_KEY);
        if (!raw) return true;
        const data = JSON.parse(raw);
        if (data && data.enabled && typeof data.enabled.snap === 'boolean') return data.enabled.snap;
    } catch (error) {
        // ignore
    }
    return true;
};
