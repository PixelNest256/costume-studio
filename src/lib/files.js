export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export class FileReadError extends Error {
    constructor (code) {
        super(code);
        this.name = 'FileReadError';
        this.code = code;
    }
}

const readAsText = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new FileReadError('read-error'));
    reader.readAsText(file, 'utf-8');
});

const readAsDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new FileReadError('read-error'));
    reader.readAsDataURL(file);
});

const getImageSize = src => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({
        width: image.naturalWidth || image.width || null,
        height: image.naturalHeight || image.height || null
    });
    image.onerror = () => resolve({width: null, height: null});
    image.src = src;
});

const isSvgDocument = svg => {
    try {
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = document.documentElement;
        return Boolean(
            root &&
            root.nodeName.toLowerCase() === 'svg' &&
            !document.querySelector('parsererror')
        );
    } catch (error) {
        return false;
    }
};

// Parse an SVG length to px, converting common absolute units.
// Percentages are not absolute sizes, so they return null here.
const parseSvgLength = value => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (trimmed.endsWith('%')) return null;
    const number = parseFloat(trimmed);
    if (!Number.isFinite(number) || number <= 0) return null;
    const lower = trimmed.toLowerCase();
    if (lower.endsWith('mm')) return number * 96 / 25.4;
    if (lower.endsWith('cm')) return number * 96 / 2.54;
    if (lower.endsWith('in')) return number * 96;
    if (lower.endsWith('pt')) return number * 96 / 72;
    if (lower.endsWith('pc')) return number * 16;
    return number;
};

const getSvgSize = svg => {
    try {
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = document.documentElement;
        if (!root || document.querySelector('parsererror')) return {width: null, height: null};

        const parse = parseSvgLength;

        let width = parse(root.getAttribute('width'));
        let height = parse(root.getAttribute('height'));
        const viewBox = root.getAttribute('viewBox');
        if ((!width || !height) && viewBox) {
            const parts = viewBox.trim().split(/[\s,]+/).map(Number);
            if (parts.length === 4) {
                width = width || (parts[2] > 0 ? parts[2] : null);
                height = height || (parts[3] > 0 ? parts[3] : null);
            }
        }
        return {width, height};
    } catch (error) {
        return {width: null, height: null};
    }
};

const getExtension = fileName => {
    const match = /\.([^.]+)$/.exec(fileName || '');
    return match ? match[1].toLowerCase() : '';
};

const getFormat = file => {
    const extension = getExtension(file.name);
    if (file.type === 'image/svg+xml' || extension === 'svg') return 'svg';
    if (file.type === 'image/png' || extension === 'png') return 'png';
    if (file.type === 'image/jpeg' || file.type === 'image/jpg' ||
        extension === 'jpg' || extension === 'jpeg') return 'jpg';
    if (file.type === 'image/gif' || extension === 'gif') return 'gif';
    if (file.type === 'image/bmp' || extension === 'bmp') return 'bmp';
    return null;
};

const sanitizeSvg = svg => {
    try {
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = document.documentElement;
        if (!root || document.querySelector('parsererror')) return null;

        const cleanup = node => {
            if (node.nodeType !== 1) {
                Array.from(node.childNodes).forEach(cleanup);
                return;
            }
            const tag = node.nodeName.toLowerCase();
            if (tag === 'script' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
                node.remove();
                return;
            }
            Array.from(node.attributes).forEach(attribute => {
                const name = attribute.name.toLowerCase();
                if (name.startsWith('on') || name === 'href' && /^\s*javascript:/i.test(attribute.value)) {
                    node.removeAttribute(attribute.name);
                }
            });
            Array.from(node.childNodes).forEach(cleanup);
        };
        cleanup(root);

        // Scratch/Paper import can mis-size SVGs declaring 100% dimensions without
        // an absolute viewport; remove those percentages before normalizing.
        // Remove those attributes so the viewBox defines the size instead.
        if (root.getAttribute('width') === '100%' && root.getAttribute('height') === '100%') {
            root.removeAttribute('width');
            root.removeAttribute('height');
        }

        const parsePx = parseSvgLength;
        const viewBox = root.getAttribute('viewBox');
        const viewBoxParts = viewBox ? viewBox.trim().split(/[\s,]+/).map(Number) : [];
        const viewBoxWidth = viewBoxParts.length === 4 && viewBoxParts[2] > 0 ? viewBoxParts[2] : null;
        const viewBoxHeight = viewBoxParts.length === 4 && viewBoxParts[3] > 0 ? viewBoxParts[3] : null;

        if (!viewBox) {
            // Scratch loadSvgString: renderer expects a viewBox; synthesize
            // one from width/height (px only, %/units fall back to defaults).
            const width = parsePx(root.getAttribute('width')) || 480;
            const height = parsePx(root.getAttribute('height')) || 360;
            root.setAttribute('viewBox', `0 0 ${width} ${height}`);
            if (!parsePx(root.getAttribute('width'))) root.setAttribute('width', String(width));
            if (!parsePx(root.getAttribute('height'))) root.setAttribute('height', String(height));
        } else {
            // Scratch normalizeSvg: fill missing width/height from viewBox.
            if (!parsePx(root.getAttribute('width')) && viewBoxWidth) {
                root.setAttribute('width', String(viewBoxWidth));
            }
            if (!parsePx(root.getAttribute('height')) && viewBoxHeight) {
                root.setAttribute('height', String(viewBoxHeight));
            }
        }
        return new XMLSerializer().serializeToString(root);
    } catch (error) {
        return null;
    }
};

const normalizeBitmap = (dataUrl, {importScale}) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
        const naturalWidth = image.naturalWidth || image.width || 0;
        const naturalHeight = image.naturalHeight || image.height || 0;
        if (!naturalWidth || !naturalHeight) {
            resolve({dataUrl, width: null, height: null});
            return;
        }
        let width = naturalWidth;
        let height = naturalHeight;
        if (importScale) {
            const ratio = Math.min(960 / width, 720 / height, 1);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);
        resolve({dataUrl: canvas.toDataURL('image/png'), width, height});
    };
    image.onerror = () => resolve({dataUrl, width: null, height: null});
    image.src = dataUrl;
});

const rasterizeSvg = (svg, {importScale, name}) => new Promise(resolve => {
    try {
        // SVG-as-image requires well-formed XML; HTML named entities such as
        // &nbsp; (common in exported taxt) make it unparseable. Replace
        // undefined entities with a space so the artwork can still rasterize.
        const fixedSvg = svg.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => (
            ['amp', 'lt', 'gt', 'quot', 'apos'].includes(entity) ? match : '&#160;'
        ));
        const url = URL.createObjectURL(new Blob([fixedSvg], {type: 'image/svg+xml;charset=utf-8'}));
        const image = new Image();
        image.onload = () => {
            try {
                let width = image.naturalWidth || image.width || 0;
                let height = image.naturalHeight || image.height || 0;
                if (!width || !height) {
                    URL.revokeObjectURL(url);
                    resolve(null);
                    return;
                }
                if (importScale) {
                    const ratio = Math.min(960 / width, 720 / height, 1);
                    width = Math.max(1, Math.round(width * ratio));
                    height = Math.max(1, Math.round(height * ratio));
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(image, 0, 0, width, height);
                URL.revokeObjectURL(url);
                resolve({
                    name: name || 'costume',
                    image: canvas.toDataURL('image/png'),
                    imageFormat: 'png',
                    format: 'bitmap',
                    width,
                    height,
                    rotationCenterX: undefined,
                    rotationCenterY: undefined
                });
            } catch (error) {
                URL.revokeObjectURL(url);
                resolve(null);
            }
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        image.src = url;
    } catch (error) {
        resolve(null);
    }
});

const getName = file => {
    const name = String(file.name || '').replace(/\.[^.]+$/, '').trim();
    return name || 'costume';
};

export const readCostumeFile = async (file, {importFixes = true, importScale = true} = {}) => {
    if (!file) throw new FileReadError('read-error');
    if (file.size > MAX_FILE_BYTES) throw new FileReadError('too-large');

    const format = getFormat(file);
    if (!format) throw new FileReadError('unsupported');

    if (format === 'svg') {
        let svg = await readAsText(file);
        if (!svg || !svg.trim()) throw new FileReadError('read-error');
        // Normalize HTML named entities that make SVG invalid XML.
        svg = svg.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => (
            ['amp', 'lt', 'gt', 'quot', 'apos'].includes(entity) ? match : '&#160;'
        ));
        if (!isSvgDocument(svg)) {
            // Some real-world SVGs are not well-formed XML (HTML entities like
            // &nbsp;, malformed attributes). Instead of rejecting them, rasterize
            // the SVG through an Image and load it as a bitmap costume so the
            // artwork is still visible and editable.
            const rasterized = await rasterizeSvg(svg, {importScale, name: getName(file)});
            if (rasterized) return rasterized;
            throw new FileReadError('read-error');
        }
        const image = importFixes ? (sanitizeSvg(svg) || svg) : svg;
        const size = getSvgSize(image);
        return {
            name: getName(file),
            image,
            imageFormat: 'svg',
            format: 'vector',
            width: size.width,
            height: size.height,
            rotationCenterX: undefined,
            rotationCenterY: undefined
        };
    }

    // Preserve source raster resolution by embedding it in an SVG wrapper
    // (scaled to fit the 480x360 stage), so quality is preserved instead of
    // downscaling to the 960x720 bitmap artboard. Redrawing through a
    // canvas first also re-encodes to PNG and strips EXIF metadata.
    const dataUrl = await readAsDataUrl(file);
    const size = await getImageSize(dataUrl);
    if (!size.width || !size.height) throw new FileReadError('read-error');

    const hdSvg = await rasterToHdSvg(dataUrl, size);
    if (hdSvg) {
        return {
            name: getName(file),
            image: hdSvg.svg,
            imageFormat: 'svg',
            format: 'vector',
            width: hdSvg.width,
            height: hdSvg.height,
            rotationCenterX: undefined,
            rotationCenterY: undefined
        };
    }

    // Fallback to plain bitmap if HD wrapping fails for any reason.
    let image = dataUrl;
    let bitmapSize = size;
    if (importFixes && (format === 'jpg' || format === 'gif' || importScale)) {
        const normalized = await normalizeBitmap(dataUrl, {importScale});
        image = normalized.dataUrl;
        bitmapSize = {width: normalized.width || size.width, height: normalized.height || size.height};
    }

    return {
        name: getName(file),
        image,
        imageFormat: image.startsWith('data:image/png') ? 'png' : format,
        format: 'bitmap',
        width: bitmapSize.width,
        height: bitmapSize.height,
        rotationCenterX: undefined,
        rotationCenterY: undefined
    };
};

// Wrap a raster data URL in an SVG at original resolution, scaled to fit
// the 480x360 costume viewport.
const rasterToHdSvg = (dataUrl, originalDim) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = originalDim.width;
            canvas.height = originalDim.height;
            canvas.getContext('2d').drawImage(image, 0, 0);
            const pngDataUrl = canvas.toDataURL('image/png');

            const STAGE_WIDTH = 480;
            const STAGE_HEIGHT = 360;
            const fitDim = (oldWidth, oldHeight) => {
                if (oldWidth <= STAGE_WIDTH && oldHeight <= STAGE_HEIGHT) {
                    return {width: oldWidth, height: oldHeight};
                }
                const imageRatio = oldWidth / oldHeight;
                if (imageRatio >= STAGE_WIDTH / STAGE_HEIGHT) {
                    return {width: STAGE_WIDTH, height: Math.floor(STAGE_WIDTH / imageRatio)};
                }
                return {width: Math.floor(STAGE_HEIGHT * imageRatio), height: STAGE_HEIGHT};
            };
            const dim = fitDim(originalDim.width, originalDim.height);
            const svg = `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0,0,${dim.width},${dim.height}" width="${dim.width}" height="${dim.height}"><g><g data-paper-data='{"isPaintingLayer":true}' fill="none" fill-rule="nonzero" stroke="none" stroke-width="0.5" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" style="mix-blend-mode: normal;"><image width="${originalDim.width}" height="${originalDim.height}" transform="scale(${dim.width / originalDim.width},${dim.height / originalDim.height})" xlink:href="${pngDataUrl}"/></g></g></svg>`;
            resolve({svg, width: dim.width, height: dim.height});
        } catch (error) {
            resolve(null);
        }
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
});
