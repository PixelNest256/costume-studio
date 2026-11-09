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
    autoBackup: true,
    // Nudge: when fixed is on, the numeric values are in project units
    // (1 = one SVG unit), independent of the current zoom.
    nudgeFixed: false,
    nudgeNormal: 1,
    nudgeShift: 15,
    // Editor workspace extensions.
    infiniteCanvas: false,
    customStage: false,
    stageWidth: 480,
    stageHeight: 360,
    repeatStage: false
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
        id: 'nudge',
        key: 'features.groupNudge',
        items: [
            ['nudgeFixed', 'features.nudgeFixed', 'features.nudgeFixedHint']
        ]
    },
    {
        id: 'workspace',
        key: 'features.groupWorkspace',
        items: [
            ['infiniteCanvas', 'features.infiniteCanvas', 'features.infiniteCanvasHint'],
            ['repeatStage', 'features.repeatStage', 'features.repeatStageHint']
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
                const fallback = DEFAULT_FEATURES[key];
                if (typeof fallback === 'boolean' && typeof data.enabled[key] === 'boolean') {
                    enabled[key] = data.enabled[key];
                } else if (typeof fallback === 'number' && Number.isFinite(data.enabled[key])) {
                    enabled[key] = data.enabled[key];
                }
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


export const getFeatureValue = id => {
    const state = loadFeatureState();
    return state.enabled[id];
};

export const getNudgeSettings = () => {
    const state = loadFeatureState();
    return {
        fixed: state.enabled.nudgeFixed === true,
        normal: Math.max(0.01, Number(state.enabled.nudgeNormal) || 1),
        shift: Math.max(0.01, Number(state.enabled.nudgeShift) || 15)
    };
};

export const getEditorSettings = () => {
    const state = loadFeatureState();
    const enabled = state.enabled;
    const width = Math.max(16, Math.min(4096, Number(enabled.stageWidth) || 480));
    const height = Math.max(16, Math.min(4096, Number(enabled.stageHeight) || 360));
    return {
        infiniteCanvas: enabled.infiniteCanvas === true,
        customStage: enabled.customStage === true,
        stageWidth: width,
        stageHeight: height,
        repeatStage: enabled.repeatStage === true
    };
};
