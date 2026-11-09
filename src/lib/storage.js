// Restore points (backups), TurboWarp-style: explicit snapshots the user
// creates manually or on a timer, instead of a silent always-on autosave.
export const BACKUPS_KEY = 'costume-studio.backups.v1';
export const BACKUPS_LIMIT = 10;
export const BACKUPS_TOTAL_LIMIT = 4500000;
// Legacy autosave key (pre-restore-points builds). Removed on startup so old
// autosaved work is not silently resurrected.
export const AUTOSAVE_KEY = 'costume-studio.autosave.v1';

const isValidDocument = data => (
    data &&
    typeof data === 'object' &&
    typeof data.image === 'string' &&
    data.image.length > 0 &&
    (data.imageFormat === 'svg' || data.imageFormat === 'png' || data.imageFormat === 'jpg') &&
    (data.format === 'vector' || data.format === 'bitmap')
);

const normalizeDocument = data => ({
    name: typeof data.name === 'string' && data.name.trim() ? data.name : 'costume',
    image: data.image,
    imageFormat: data.imageFormat,
    format: data.format,
    width: Number.isFinite(data.width) ? data.width : null,
    height: Number.isFinite(data.height) ? data.height : null,
    rotationCenterX: Number.isFinite(data.rotationCenterX) ? data.rotationCenterX : undefined,
    rotationCenterY: Number.isFinite(data.rotationCenterY) ? data.rotationCenterY : undefined
});

export const getBackupFingerprint = data => {
    if (!data || !data.image) return '';
    // Content, not file name/timestamp, identifies the same saved costume.
    return [
        data.name || '',
        data.format || '',
        data.imageFormat || '',
        data.image,
        Number.isFinite(data.width) ? data.width : '',
        Number.isFinite(data.height) ? data.height : '',
        Number.isFinite(data.rotationCenterX) ? data.rotationCenterX : '',
        Number.isFinite(data.rotationCenterY) ? data.rotationCenterY : ''
    ].join('\u0000');
};

export const loadBackups = () => {
    try {
        const raw = window.localStorage.getItem(BACKUPS_KEY);
        if (!raw) return [];
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return [];
        return data
            .filter(entry => entry && isValidDocument(entry.doc))
            .map(entry => ({
                id: typeof entry.id === 'string' ? entry.id : String(entry.savedAt || Math.random()),
                savedAt: Number.isFinite(entry.savedAt) ? entry.savedAt : null,
                doc: normalizeDocument(entry.doc)
            }))
            .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    } catch (error) {
        return [];
    }
};

export const hasBackup = document => {
    const fingerprint = getBackupFingerprint(document);
    return Boolean(fingerprint) && loadBackups().some(entry => getBackupFingerprint(entry.doc) === fingerprint);
};

export const saveBackup = document => {
    if (!document.image) return {ok: false, reason: 'empty'};
    const fingerprint = getBackupFingerprint(document);
    if (loadBackups().some(entry => getBackupFingerprint(entry.doc) === fingerprint)) {
        return {ok: false, reason: 'duplicate'};
    }
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        savedAt: Date.now(),
        doc: normalizeDocument(document)
    };
    let backups = loadBackups();
    backups.unshift(entry);
    backups = backups.slice(0, BACKUPS_LIMIT);

    // Enforce a total size budget: drop oldest backups until it fits.
    while (backups.length > 1 && JSON.stringify(backups).length > BACKUPS_TOTAL_LIMIT) {
        backups.pop();
    }
    if (JSON.stringify(backups).length > BACKUPS_TOTAL_LIMIT) {
        return {ok: false, reason: 'too-large'};
    }
    try {
        window.localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
        return {ok: true, entry};
    } catch (error) {
        return {ok: false, reason: 'storage-error'};
    }
};

export const deleteBackup = id => {
    try {
        const backups = loadBackups().filter(entry => entry.id !== id);
        window.localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
        return {ok: true};
    } catch (error) {
        return {ok: false};
    }
};

export const clearBackups = () => {
    try {
        window.localStorage.removeItem(BACKUPS_KEY);
    } catch (error) {
        // Ignore storage failures.
    }
};

export const clearAutosave = () => {
    try {
        window.localStorage.removeItem(AUTOSAVE_KEY);
    } catch (error) {
        // Ignore storage failures.
    }
};
