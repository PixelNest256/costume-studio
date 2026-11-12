// Keyboard shortcut formatting shared by the app shell and the vendored paint
// editor. The editor accepts both Ctrl (Windows/Linux) and Command (macOS).
const isMac = () => (
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '')
);

export const isMacPlatform = isMac;

// Accepts strings such as "Ctrl+Shift+ArrowUp", "Shift+H", "Tab" or "?".
export const formatShortcut = shortcut => {
    if (!shortcut) return '';
    const modifier = isMac() ? '⌘' : 'Ctrl';
    return String(shortcut)
        .split('+')
        .map(part => {
            if (part === 'Ctrl' || part === 'Cmd' || part === 'Meta') return modifier;
            if (part === 'ArrowUp') return '↑';
            if (part === 'ArrowDown') return '↓';
            if (part === 'ArrowLeft') return '←';
            if (part === 'ArrowRight') return '→';
            return part;
        })
        .join('+');
};

export const withShortcut = (label, shortcut) => {
    const formatted = formatShortcut(shortcut);
    return formatted && label ? `${label} (${formatted})` : label;
};

export const TOOL_SHORTCUTS = {
    'paint.selectMode.select': 'S',
    'paint.reshapeMode.reshape': 'A',
    'paint.brushMode.brush': 'B',
    'paint.eraserMode.eraser': 'E',
    'paint.fillMode.fill': 'F',
    'paint.textMode.text': 'T',
    'paint.lineMode.line': 'L',
    'paint.ovalMode.oval': 'C',
    'paint.penMode.pen': 'P',
    'paint.polygonMode.polygon': 'Y',
    'paint.arrowMode.arrow': 'V',
    'paint.shapeMode.shape': 'M'
};
