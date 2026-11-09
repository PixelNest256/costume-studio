import opentype from 'opentype.js';
import fontsModule from '../vendor/scratch-render-fonts.js';

export const CUSTOM_FONTS_CHANGED_EVENT = 'costume-fonts-changed';

const DB_NAME = 'costume-studio-custom-fonts';
const STORE_NAME = 'fonts';
const MAX_FONT_BYTES = 15 * 1024 * 1024;
const MAX_FONT_COUNT = 20;

// Families provided by the bundled Scratch font payload. A custom font may not
// reuse these names, and they are offered as fallbacks.
export const FALLBACK_FAMILIES = ['Sans Serif', 'Serif', 'Handwriting'];
const RESERVED_FAMILIES = [
    ...FALLBACK_FAMILIES,
    'Marker',
    'Curly',
    'Pixel',
    'Scratch',
    'Chinese',
    'Japanese',
    'Korean',
    '中文',
    '日本語',
    '한국어'
];

const getFallbackDataUrl = name => {
    if (fontsModule && typeof fontsModule.getFontDataUrl === 'function') {
        const bundled = fontsModule.getFontDataUrl(name);
        if (bundled) return bundled;
    }
    // A fallback may be another added font with an embedded file.
    const record = Array.from(records.values()).find(entry => entry.family === name);
    return record && record.dataUrl ? record.dataUrl : null;
};

const records = new Map();
const pathFonts = new Map();
const installedFaces = new Map();
let dbPromise;
let loadPromise;

const openDatabase = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('font-storage-unavailable'));
            return;
        }
        const request = window.indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {keyPath: 'id'});
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('font-storage-failed'));
    });
    return dbPromise;
};

const withStore = async (mode, callback) => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const request = callback(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('font-storage-failed'));
        transaction.onabort = () => reject(transaction.error || new Error('font-storage-failed'));
    });
};

const normalizeFamily = value => String(value || '')
    // A family name is written into SVG/CSS attributes. Drop characters that
    // would break XML/CSS rather than allowing a font name to corrupt the
    // document (for example a name containing "&" or a quote).
    .replace(/[&<>"'\\]/g, '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

const isFamilyTaken = family => {
    const lower = family.toLowerCase();
    return RESERVED_FAMILIES.some(name => name.toLowerCase() === lower) ||
        Array.from(records.values()).some(record => record.family.toLowerCase() === lower);
};

const makeUniqueFamily = base => {
    const root = normalizeFamily(base) || 'Imported font';
    if (!isFamilyTaken(root)) return root;
    let index = 2;
    while (isFamilyTaken(`${root} (${index})`)) index += 1;
    return `${root} (${index})`;
};

const toArrayBuffer = async dataUrl => {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error('font-read-failed');
    return response.arrayBuffer();
};

let fontkitLoader;
const loadFontkit = () => {
    if (!fontkitLoader) {
        fontkitLoader = import('fontkit').then(module => (
            module.create || (module.default && module.default.create)
        ));
    }
    return fontkitLoader;
};

const appendFontkitCommands = (parts, commands, offsetX, baselineY, scale) => {
    const px = value => offsetX + (value * scale);
    const py = value => baselineY - (value * scale);
    for (const {command, args} of commands) {
        if (command === 'moveTo') {
            parts.push(`M${px(args[0])} ${py(args[1])}`);
        } else if (command === 'lineTo') {
            parts.push(`L${px(args[0])} ${py(args[1])}`);
        } else if (command === 'quadraticCurveTo') {
            parts.push(`Q${px(args[0])} ${py(args[1])} ${px(args[2])} ${py(args[3])}`);
        } else if (command === 'bezierCurveTo') {
            parts.push(`C${px(args[0])} ${py(args[1])} ${px(args[2])} ${py(args[3])} ${px(args[4])} ${py(args[5])}`);
        } else if (command === 'closePath') {
            parts.push('Z');
        }
    }
};

const pickFontkitFont = font => (
    font && Array.isArray(font.fonts) && font.fonts.length ? font.fonts[0] : font
);

const layoutText = (font, text) => {
    try {
        return font.layout(text);
    } catch (error) {
        // Complex scripts or a broken cmap can make whole-run shaping fail.
        // Lay out character by character as a safe fallback.
    }
    const glyphs = [];
    const positions = [];
    for (const character of Array.from(text)) {
        try {
            const run = font.layout(character);
            for (let index = 0; index < run.glyphs.length; index++) {
                glyphs.push(run.glyphs[index]);
                positions.push(run.positions[index]);
            }
        } catch (error) {
            // Skip characters the font cannot lay out.
        }
    }
    return {glyphs, positions};
};

const fontkitOutline = font => {
    const single = pickFontkitFont(font);
    const scaleFor = size => size / (single.unitsPerEm || 1000);
    return {
        getAdvanceWidth: (text, size) => {
            const run = layoutText(single, text);
            let width = 0;
            for (const position of run.positions || []) width += position.xAdvance || 0;
            return width * scaleFor(size);
        },
        getPathData: (text, x, y, size) => {
            const run = layoutText(single, text);
            const scale = scaleFor(size);
            const parts = [];
            let pen = 0;
            for (let index = 0; index < run.glyphs.length; index++) {
                const glyph = run.glyphs[index];
                const position = (run.positions && run.positions[index]) || {};
                const offsetX = x + ((pen + (position.xOffset || 0)) * scale);
                const baselineY = y - ((position.yOffset || 0) * scale);
                const commands = glyph && glyph.path && glyph.path.commands;
                if (commands) appendFontkitCommands(parts, commands, offsetX, baselineY, scale);
                pen += position.xAdvance || 0;
            }
            return parts.join('');
        }
    };
};

const opentypeOutline = font => ({
    getAdvanceWidth: (text, size) => font.getAdvanceWidth(text, size),
    getPathData: (text, x, y, size) => {
        // Use one path per glyph. opentype.js can emit a NaN control point in
        // the combined getPath() result for some fonts; the per-glyph paths are
        // clean and keep their kerning-aware positions.
        return font.getPaths(text, x, y, size)
            .map(glyphPath => glyphPath.toPathData(3))
            .join('');
    }
});

const dualOutline = (primary, secondary) => {
    const call = (method, args) => {
        try {
            const value = primary[method](...args);
            if (method === 'getPathData' && typeof value === 'string' && /NaN|undefined/.test(value)) {
                throw new Error('invalid-path-data');
            }
            if (method === 'getAdvanceWidth' && !Number.isFinite(value)) {
                throw new Error('invalid-advance-width');
            }
            return value;
        } catch (error) {
            if (!secondary) throw error;
            return secondary[method](...args);
        }
    };
    return {
        getAdvanceWidth: (text, size) => call('getAdvanceWidth', [text, size]),
        getPathData: (text, x, y, size) => call('getPathData', [text, x, y, size])
    };
};

const parseOutline = async (buffer, format) => {
    // Prefer opentype.js for formats it understands (it keeps the original
    // metrics exactly), and fontkit for WOFF2/CFF variants. Both are loaded
    // when possible so a runtime failure in either can fall back to the other.
    let fontkitOut = null;
    let opentypeOut = null;
    try {
        const create = await loadFontkit();
        if (create) fontkitOut = fontkitOutline(create(new Uint8Array(buffer)));
    } catch (error) {
        // Fall through to opentype.js.
    }
    try {
        opentypeOut = opentypeOutline(opentype.parse(buffer));
    } catch (error) {
        // WOFF2 and some CFF fonts are fontkit-only.
    }
    if (!fontkitOut && !opentypeOut) throw new Error('font-outline-unavailable');
    const opentypePrimary = Boolean(opentypeOut) && format !== 'woff2';
    const primary = opentypePrimary ? opentypeOut : (fontkitOut || opentypeOut);
    const secondary = primary === opentypeOut ? fontkitOut : opentypeOut;
    return dualOutline(primary, secondary);
};

const parseNameFromBuffer = async (buffer, format, file) => {
    try {
        return parseNameFromFont(opentype.parse(buffer));
    } catch (error) {
        if (format === 'woff2' || format === 'woff') {
            try {
                const create = await loadFontkit();
                const font = pickFontkitFont(create(new Uint8Array(buffer)));
                return normalizeFamily(font.familyName || font.fullName || '');
            } catch (fontkitError) {
                // Fall back to the file name below.
            }
        }
        return parseNameFromFile(file);
    }
};

const getExtension = fileName => {
    const match = /\.([^.]+)$/.exec(String(fileName || ''));
    return match ? match[1].toLowerCase() : '';
};

const getFormat = file => {
    const extension = getExtension(file && file.name);
    if (extension) return extension;
    const mime = String((file && file.type) || '').toLowerCase();
    if (mime.includes('woff2')) return 'woff2';
    if (mime.includes('woff')) return 'woff';
    if (mime.includes('opentype') || mime.includes('otf')) return 'otf';
    return 'ttf';
};

const getMimeType = format => ({
    woff2: 'font/woff2',
    woff: 'font/woff',
    otf: 'font/otf'
}[format] || 'font/ttf');

const readAsDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('font-read-failed'));
    reader.readAsDataURL(file);
});

const parseNameFromFont = font => {
    // opentype.js exposes name tables per platform (font.names.windows.*), but
    // older shapes expose them directly. Read both and prefer the typographic
    // (preferred) family, then the legacy family, then the full name.
    const readName = key => {
        const names = font && font.names ? font.names : {};
        const readEntry = entry => {
            if (!entry) return '';
            if (typeof entry === 'string') return entry;
            return entry.en || entry.ja || entry.zh || entry.ko || Object.values(entry)[0] || '';
        };
        const direct = readEntry(names[key]);
        if (direct) return direct;
        for (const table of Object.values(names)) {
            if (!table || typeof table !== 'object') continue;
            const value = readEntry(table[key]);
            if (value) return value;
        }
        return '';
    };
    return normalizeFamily(
        readName('preferredFamily') ||
        readName('fontFamily') ||
        readName('fullName') ||
        readName('postScriptName')
    );
};

const parseNameFromFile = file => normalizeFamily(
    String((file && file.name) || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
);

const removeFace = family => {
    const faces = installedFaces.get(family);
    if (!faces) return;
    for (const face of faces) {
        try {
            document.fonts.delete(face);
        } catch (error) {
            // Ignore fonts that were never installed.
        }
    }
    installedFaces.delete(family);
};

const addFace = async (family, source) => {
    const face = new FontFace(family, source);
    await face.load();
    document.fonts.add(face);
    if (!installedFaces.has(family)) installedFaces.set(family, []);
    installedFaces.get(family).push(face);
    return face;
};

const recordFamilies = record => [
    record.family,
    record.legacyFamily
].filter((family, index, list) => family && list.indexOf(family) === index);

const installFallbackFace = async record => {
    if (!record.fallback) return;
    const dataUrl = getFallbackDataUrl(record.fallback);
    if (!dataUrl) return;
    for (const family of recordFamilies(record)) {
        try {
            await addFace(family, `url("${dataUrl}")`);
        } catch (error) {
            console.warn('Could not install the fallback font.', error);
        }
    }
};

const loadRecord = async record => {
    if (record.system) {
        for (const family of recordFamilies(record)) pathFonts.delete(family);
        // Prefer the font installed on this device, then the chosen fallback.
        // The fallback bytes come from the bundled Scratch font subset, so the
        // text still renders when a system font name does not resolve.
        const fallbackUrl = getFallbackDataUrl(record.fallback);
        if (fallbackUrl) {
            for (const family of recordFamilies(record)) {
                try {
                    await addFace(family, `local("${family}"), url("${fallbackUrl}")`);
                } catch (error) {
                    // Leave the family to the browser's normal font resolution.
                }
            }
        }
        return record;
    }
    for (const family of recordFamilies(record)) {
        try {
            await addFace(family, `url("${record.dataUrl}")`);
        } catch (error) {
            // The font is unusable, but the text can still render because the
            // user chose a fallback. Register the fallback under this family.
            try {
                await installFallbackFace({...record, family});
            } catch (fallbackError) {
                // Ignore; the browser will use its default font.
            }
        }
    }
    try {
        const buffer = await toArrayBuffer(record.dataUrl);
        const outline = await parseOutline(buffer, record.format);
        for (const family of recordFamilies(record)) pathFonts.set(family, outline);
    } catch (error) {
        // Some fonts can display through FontFace but cannot provide outlines.
        // Keep them usable for text; path export reports the skip.
        for (const family of recordFamilies(record)) pathFonts.delete(family);
    }
    return record;
};

const normalizeRecord = raw => {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
    const fallback = FALLBACK_FAMILIES.includes(raw.fallback) ? raw.fallback : 'Sans Serif';
    if (raw.system) {
        const name = normalizeFamily(raw.name || raw.family);
        if (!name) return null;
        return {
            id: raw.id,
            name,
            family: normalizeFamily(raw.family) || makeUniqueFamily(name),
            fallback,
            system: true,
            format: null,
            dataUrl: null
        };
    }
    if (typeof raw.dataUrl !== 'string' || !raw.dataUrl.startsWith('data:')) return null;
    const name = normalizeFamily(raw.name || raw.family) || 'Imported font';
    // Records created before the family/name split used an internal family
    // ("CostumeStudioFont-<id>"). Text made with those records references the
    // old name, so keep it as an alias for rendering and path export.
    const normalizedRawFamily = raw.family ? normalizeFamily(raw.family) : '';
    const legacyFamily = raw.legacyFamily ||
        (!raw.family && raw.id ?
            `CostumeStudioFont-${String(raw.id).replace(/[^a-zA-Z0-9-]/g, '')}` :
            (raw.family && normalizedRawFamily !== raw.family ? raw.family : undefined));
    const format = raw.format || (() => {
        const match = /^data:([^;,]+)/.exec(raw.dataUrl);
        const mime = match ? match[1].toLowerCase() : '';
        if (mime.includes('woff2')) return 'woff2';
        if (mime.includes('woff')) return 'woff';
        if (mime.includes('otf') || mime.includes('opentype')) return 'otf';
        return 'ttf';
    })();
    return {
        id: raw.id,
        name,
        family: normalizedRawFamily || makeUniqueFamily(name),
        legacyFamily,
        fallback,
        system: false,
        format,
        dataUrl: raw.dataUrl
    };
};

const emitChange = () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CUSTOM_FONTS_CHANGED_EVENT));
};

export const getCustomFonts = () => Array.from(records.values())
    .filter(record => record && record.family)
    .map(record => ({
        id: record.id,
        name: record.name,
        family: record.family,
        legacyFamily: record.legacyFamily,
        fallback: record.fallback,
        system: Boolean(record.system),
        hasOutline: pathFonts.has(record.family)
    }));

export const getCustomFont = family => {
    const record = Array.from(records.values()).find(entry =>
        entry.family === family || entry.legacyFamily === family);
    if (!record) return null;
    return {
        record,
        font: pathFonts.get(family) || pathFonts.get(record.family) || null
    };
};

// Built-in Scratch font families that can be reconstructed from the bundled
// font payload. Marker/Curly/Pixel are aliased to Sans Serif by the bundled
// font CSS, so their outlines use the same data.
const BUILTIN_FONT_MAP = {
    'Sans Serif': 'Sans Serif',
    'Serif': 'Serif',
    'Handwriting': 'Handwriting',
    'Marker': 'Sans Serif',
    'Curly': 'Sans Serif',
    'Pixel': 'Sans Serif',
    'Scratch': 'Sans Serif'
};
const builtinOutlines = new Map();
const dataUrlToBytes = dataUrl => {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};
export const getBuiltinOutline = async family => {
    const bundled = BUILTIN_FONT_MAP[family];
    if (!bundled) return null;
    if (builtinOutlines.has(bundled)) return builtinOutlines.get(bundled);
    const dataUrl = fontsModule && typeof fontsModule.getFontDataUrl === 'function' ?
        fontsModule.getFontDataUrl(bundled) :
        null;
    if (!dataUrl) return null;
    try {
        const create = await loadFontkit();
        if (!create) return null;
        const outline = fontkitOutline(create(dataUrlToBytes(dataUrl)));
        builtinOutlines.set(bundled, outline);
        return outline;
    } catch (error) {
        // If fontkit cannot be loaded, fall back to opentype.js. The latter has
        // a known NaN issue for a few glyphs, so only use it as a last resort.
        try {
            const outline = opentypeOutline(opentype.parse(dataUrlToBytes(dataUrl).buffer));
            builtinOutlines.set(bundled, outline);
            return outline;
        } catch (fallbackError) {
            return null;
        }
    }
};

export const loadCustomFonts = () => {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        try {
            const stored = await withStore('readonly', store => store.getAll());
            records.clear();
            for (const raw of stored || []) {
                const record = normalizeRecord(raw);
                if (!record) continue;
                if (isFamilyTaken(record.family)) record.family = makeUniqueFamily(record.name);
                records.set(record.id, record);
                if (record.family !== raw.family || record.name !== raw.name) {
                    try {
                        // Migrate pre-family records so the picker and the SVG
                        // use the same, user-visible family name.
                        await withStore('readwrite', store => store.put(record));
                    } catch (error) {
                        // Storage migration is best effort.
                    }
                }
            }
            for (const record of records.values()) {
                await loadRecord(record);
            }
            emitChange();
        } catch (error) {
            // Without IndexedDB, custom fonts are unavailable but the editor
            // and built-in fonts continue to work.
        }
        return getCustomFonts();
    })();
    return loadPromise;
};

export const importCustomFontFile = async (file, {name, fallback} = {}) => {
    if (!file) throw new Error('font-empty');
    if (file.size > MAX_FONT_BYTES) throw new Error('font-too-large');
    const format = getFormat(file);
    if (!['ttf', 'otf', 'woff', 'woff2'].includes(format)) throw new Error('font-unsupported');
    if (records.size >= MAX_FONT_COUNT) throw new Error('font-limit');

    const dataUrl = await readAsDataUrl(file);
    const buffer = await toArrayBuffer(dataUrl);
    let parsedName = '';
    try {
        parsedName = await parseNameFromBuffer(buffer, format, file);
    } catch (error) {
        if (format !== 'woff2' && format !== 'woff') throw new Error('font-invalid');
    }

    const family = makeUniqueFamily(name || parsedName || parseNameFromFile(file));
    const record = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ?
            crypto.randomUUID() :
            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: family,
        family,
        fallback: FALLBACK_FAMILIES.includes(fallback) ? fallback : 'Sans Serif',
        system: false,
        format,
        dataUrl: dataUrl.startsWith(`data:${getMimeType(format)}`) ?
            dataUrl :
            dataUrl.replace(/^data:[^;]*/, `data:${getMimeType(format)}`)
    };
    await withStore('readwrite', store => store.add(record));
    records.set(record.id, record);
    await loadRecord(record);
    emitChange();
    return getCustomFonts().find(entry => entry.id === record.id);
};

export const addSystemFont = async (name, fallback = 'Sans Serif') => {
    const requested = normalizeFamily(name);
    if (!requested) throw new Error('font-name-required');
    if (records.size >= MAX_FONT_COUNT) throw new Error('font-limit');
    const family = makeUniqueFamily(requested);
    const record = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ?
            crypto.randomUUID() :
            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: family,
        family,
        fallback: FALLBACK_FAMILIES.includes(fallback) ? fallback : 'Sans Serif',
        system: true,
        format: null,
        dataUrl: null
    };
    await withStore('readwrite', store => store.add(record));
    records.set(record.id, record);
    await loadRecord(record);
    emitChange();
    return getCustomFonts().find(entry => entry.id === record.id);
};

export const removeCustomFont = async id => {
    const record = records.get(id);
    if (!record) return;
    await withStore('readwrite', store => store.delete(id));
    records.delete(id);
    for (const family of recordFamilies(record)) {
        pathFonts.delete(family);
        removeFace(family);
    }
    emitChange();
};

const getAttribute = (element, name, fallback = '') => element.getAttribute(name) || fallback;
const parseNumber = (value, fallback = 0) => {
    const match = /^\s*(-?(?:\d+\.?\d*|\.\d+))(?:px|pt|pc|mm|cm|in|em|%)?\s*$/i.exec(value || '');
    return match ? Number(match[1]) : fallback;
};
const parseFontSizeValue = (value, relativeTo = 18) => {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (text.endsWith('%')) return parseNumber(text) * relativeTo / 100;
    if (text.endsWith('pt')) return parseNumber(text) * 4 / 3;
    if (text.endsWith('pc')) return parseNumber(text) * 16;
    if (text.endsWith('mm')) return parseNumber(text) * 96 / 25.4;
    if (text.endsWith('cm')) return parseNumber(text) * 96 / 2.54;
    if (text.endsWith('in')) return parseNumber(text) * 96;
    if (text.endsWith('em')) return parseNumber(text) * relativeTo;
    return parseNumber(text, relativeTo);
};

const parseFontSize = element => {
    // SVG permits presentation attributes and inline styles, and font-size may
    // be inherited from an ancestor group. Reading only the text element's
    // attribute made converted paths fall back to 18px (and look resized).
    let current = element;
    let inherited = 18;
    while (current && current.nodeType === 1) {
        const attribute = current.getAttribute('font-size');
        const inline = styleValue(current, 'font-size');
        const value = attribute || inline;
        if (value) {
            const parsed = parseFontSizeValue(value, inherited);
            if (parsed) return parsed;
        }
        current = current.parentElement;
    }
    return 18;
};
const parseTranslateLength = (value, fontSize) => {
    if (!value) return 0;
    const number = parseNumber(value);
    return value.trim().endsWith('em') ? number * fontSize : number;
};
const styleValue = (element, property) => {
    const inline = element.getAttribute('style') || '';
    const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(inline);
    return match ? match[1].trim() : '';
};
const copyPresentation = (source, target, ignored) => {
    for (const attribute of Array.from(source.attributes)) {
        const name = attribute.name;
        if (ignored.has(name) || name === 'style') continue;
        target.setAttribute(name, attribute.value);
    }
    const style = source.getAttribute('style');
    if (style) {
        const remaining = style.split(';').map(rule => rule.trim()).filter(rule => rule &&
            !/^font-(family|size|weight|style)\s*:/i.test(rule) &&
            !/^(text-anchor|dominant-baseline|alignment-baseline)\s*:/i.test(rule));
        if (remaining.length) target.setAttribute('style', remaining.join('; '));
    }
};

const getTextRuns = (textElement, outline) => {
    const spans = Array.from(textElement.children).filter(child => child.localName === 'tspan');
    if (!spans.length) {
        const lines = (textElement.textContent || '').split('\n');
        const baseX = parseNumber(getAttribute(textElement, 'x'));
        const baseY = parseNumber(getAttribute(textElement, 'y'));
        const fontSize = parseFontSize(textElement);
        return lines.map((text, index) => ({
            element: textElement,
            text,
            x: baseX,
            y: baseY + (index ? index * fontSize * 1.2 : 0),
            fontSize
        }));
    }
    let x = parseNumber(getAttribute(textElement, 'x'));
    let y = parseNumber(getAttribute(textElement, 'y'));
    const runs = [];
    for (const span of spans) {
        const fontSize = parseFontSize(span) || parseFontSize(textElement);
        if (span.hasAttribute('x')) x = parseNumber(span.getAttribute('x'), x);
        if (span.hasAttribute('y')) y = parseNumber(span.getAttribute('y'), y);
        if (span.hasAttribute('dx')) x += parseTranslateLength(span.getAttribute('dx'), fontSize);
        if (span.hasAttribute('dy')) y += parseTranslateLength(span.getAttribute('dy'), fontSize);
        const text = span.textContent || '';
        const anchor = getAttribute(span, 'text-anchor', getAttribute(textElement, 'text-anchor'));
        runs.push({element: span, text, x, y, fontSize, anchor});
        if (outline) {
            try {
                x += outline.getAdvanceWidth(text, fontSize);
            } catch (error) {
                // Leave the pen where it is; the next line still renders.
            }
        }
    }
    return runs;
};

const lookupFontFamily = value => {
    const first = String(value || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
    return first;
};

const escapeCssString = value => String(value).replace(/["\\]/g, '\\$&');

// The PNG exporter rasterizes the SVG as an isolated image, so fonts registered
// through FontFace on the page are not visible inside it. Embed the added font
// files into the temporary SVG so PNG output keeps the intended typeface.
export const embedCustomFontsInSvg = svg => {
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (!document.documentElement || document.querySelector('parsererror')) return svg;
    const used = new Set();
    for (const textElement of Array.from(document.getElementsByTagName('text'))) {
        used.add(lookupFontFamily(getAttribute(textElement, 'font-family')));
    }
    const rules = [];
    for (const family of used) {
        const custom = getCustomFont(family);
        if (!custom || !custom.record.dataUrl) continue;
        rules.push(`@font-face{font-family:"${escapeCssString(family)}";src:url("${custom.record.dataUrl}");}`);
    }
    if (!rules.length) return svg;
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = rules.join('');
    document.documentElement.insertBefore(style, document.documentElement.firstChild);
    return new XMLSerializer().serializeToString(document.documentElement);
};


export const convertCustomFontTextToPaths = async svg => {
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (!document.documentElement || document.querySelector('parsererror')) throw new Error('invalid-svg');
    let converted = 0;
    let skipped = 0;
    const textElements = Array.from(document.getElementsByTagName('text'));
    for (const textElement of textElements) {
        const family = lookupFontFamily(getAttribute(textElement, 'font-family')) || 'Sans Serif';
        const custom = getCustomFont(family);
        const outline = custom ? custom.font : await getBuiltinOutline(family);
        if (!outline) {
            if (custom) {
                // An imported system font (or one whose outline could not be
                // loaded) can display but has no outline data to convert.
                skipped += 1;
            }
            continue;
        }
        if (textElement.hasAttribute('textLength') || textElement.querySelector('textPath')) {
            skipped += 1;
            continue;
        }
        const anchor = getAttribute(textElement, 'text-anchor', styleValue(textElement, 'text-anchor'));
        const fontSize = parseFontSize(textElement);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        copyPresentation(textElement, group, new Set([
            'x', 'y', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust',
            'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
            'dominant-baseline', 'alignment-baseline', 'xml:space'
        ]));
        let runs;
        try {
            runs = getTextRuns(textElement, outline);
        } catch (error) {
            console.warn('Could not read text runs for font conversion.', error);
            skipped += 1;
            continue;
        }
        for (const run of runs) {
            if (!run.text) continue;
            const runFontSize = run.fontSize || fontSize;
            const runAnchor = run.anchor || anchor;
            let x = run.x;
            let width = 0;
            try {
                width = outline.getAdvanceWidth(run.text, runFontSize);
            } catch (error) {
                console.warn('Could not measure text for font conversion.', error);
                skipped += 1;
                continue;
            }
            if (runAnchor === 'middle') x -= width / 2;
            if (runAnchor === 'end') x -= width;
            // Emit one <path> per character so imported text becomes separate
            // editable objects instead of a single combined outline.
            let penX = x;
            for (const character of Array.from(run.text)) {
                let advance = runFontSize * 0.5;
                try {
                    advance = outline.getAdvanceWidth(character, runFontSize);
                } catch (error) {
                    // Use a conservative advance for a broken glyph.
                }
                let pathData = '';
                try {
                    pathData = outline.getPathData(character, penX, run.y, runFontSize);
                } catch (error) {
                    console.warn('Could not convert a character to a path.', error);
                }
                if (pathData && !pathData.includes('NaN')) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', pathData);
                    const fill = getAttribute(run.element, 'fill', styleValue(run.element, 'fill'));
                    const stroke = getAttribute(run.element, 'stroke', styleValue(run.element, 'stroke'));
                    if (fill) path.setAttribute('fill', fill);
                    if (stroke) path.setAttribute('stroke', stroke);
                    for (const attr of ['opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) {
                        const value = getAttribute(run.element, attr);
                        if (value) path.setAttribute(attr, value);
                    }
                    group.appendChild(path);
                }
                penX += advance;
            }
        }
        const paths = Array.from(group.childNodes).filter(node => node.nodeType === 1);
        if (!paths.length || !textElement.parentNode) {
            skipped += 1;
            continue;
        }
        // Insert each glyph at the text element's level instead of wrapping
        // them in a group, so Scratch/Paper imports them as separate objects.
        for (const path of paths) {
            for (const attribute of Array.from(group.attributes)) {
                if (!path.hasAttribute(attribute.name)) {
                    path.setAttribute(attribute.name, attribute.value);
                }
            }
            const groupStyle = group.getAttribute('style');
            if (groupStyle) {
                const pathStyle = path.getAttribute('style');
                path.setAttribute('style', [groupStyle, pathStyle].filter(Boolean).join(';'));
            }
            textElement.parentNode.insertBefore(path, textElement);
        }
        textElement.remove();
        converted += 1;
    }
    return {svg: new XMLSerializer().serializeToString(document.documentElement), converted, skipped};
};
