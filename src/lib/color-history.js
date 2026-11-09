export const COLOR_HISTORY_STORAGE_KEY = 'costume-studio.color-history.v1';
export const COLOR_HISTORY_LIMIT = 10;

const normalize = value => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^#([0-9a-f]{3,8})$/i);
    if (!match) return null;
    let hex = match[1];
    if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
    if (hex.length === 4) hex = hex.split('').map(char => char + char).join('');
    if (hex.length !== 6 && hex.length !== 8) return null;
    return `#${hex.toLowerCase()}`;
};

export const getColorHistory = () => {
    try {
        const raw = window.localStorage.getItem(COLOR_HISTORY_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalize).filter(Boolean).slice(0, COLOR_HISTORY_LIMIT);
    } catch (error) {
        return [];
    }
};

export const addColorHistory = color => {
    const normalized = normalize(color);
    if (!normalized) return getColorHistory();
    const next = [normalized, ...getColorHistory().filter(item => item !== normalized)]
        .slice(0, COLOR_HISTORY_LIMIT);
    try {
        window.localStorage.setItem(COLOR_HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
        // History is a convenience; never block the editor on storage errors.
    }
    return next;
};

export {normalize as normalizeHexColor};
