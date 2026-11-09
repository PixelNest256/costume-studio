const MAX_EXPORT_DIMENSION = 8192;

const loadImage = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image-load-failed'));
    image.src = src;
});

const canvasToBlob = canvas => new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
        if (blob) {
            resolve(blob);
        } else {
            reject(new Error('png-encode-failed'));
        }
    }, 'image/png');
});

const parseLength = value => {
    if (!value) return null;
    if (String(value).trim().endsWith('%')) return null;
    const number = parseFloat(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};

export const getSvgInfo = svg => {
    try {
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = document.documentElement;
        if (!root || root.nodeName.toLowerCase() !== 'svg' || document.querySelector('parsererror')) {
            return {width: null, height: null};
        }

        let width = parseLength(root.getAttribute('width'));
        let height = parseLength(root.getAttribute('height'));
        const viewBox = root.getAttribute('viewBox');

        if ((!width || !height) && viewBox) {
            const parts = viewBox.trim().split(/[\s,]+/).map(Number);
            if (parts.length === 4) {
                width = width || (Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : null);
                height = height || (Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : null);
            }
        }

        return {width, height};
    } catch (error) {
        return {width: null, height: null};
    }
};

export const imageDataToDataUrl = imageData => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
};

export const bitmapToSvg = (dataUrl, width, height) => {
    const w = Math.max(1, Math.round(width || 480));
    const h = Math.max(1, Math.round(height || 360));
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
        `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<image width="${w}" height="${h}" href="${dataUrl}" xlink:href="${dataUrl}"/>` +
        '</svg>';
};

export const svgToPngBlob = async (svg, inlineSvgFonts, scale = 1) => {
    const info = getSvgInfo(svg);
    const width = info.width || 480;
    const height = info.height || 360;

    let renderWidth = Math.max(1, Math.round(width * scale));
    let renderHeight = Math.max(1, Math.round(height * scale));
    if (renderWidth > MAX_EXPORT_DIMENSION || renderHeight > MAX_EXPORT_DIMENSION) {
        const ratio = Math.min(
            MAX_EXPORT_DIMENSION / renderWidth,
            MAX_EXPORT_DIMENSION / renderHeight
        );
        renderWidth = Math.max(1, Math.floor(renderWidth * ratio));
        renderHeight = Math.max(1, Math.floor(renderHeight * ratio));
    }

    const portableSvg = inlineSvgFonts ? inlineSvgFonts(svg) : svg;
    const url = URL.createObjectURL(new Blob([portableSvg], {type: 'image/svg+xml;charset=utf-8'}));

    try {
        const image = await loadImage(url);
        const canvas = document.createElement('canvas');
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, renderWidth, renderHeight);
        return await canvasToBlob(canvas);
    } finally {
        URL.revokeObjectURL(url);
    }
};

export const pngToPngBlob = async (dataUrl, scale = 1) => {
    const image = await loadImage(dataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    let renderWidth = Math.max(1, Math.round(width * scale));
    let renderHeight = Math.max(1, Math.round(height * scale));
    if (renderWidth > MAX_EXPORT_DIMENSION || renderHeight > MAX_EXPORT_DIMENSION) {
        const ratio = Math.min(
            MAX_EXPORT_DIMENSION / renderWidth,
            MAX_EXPORT_DIMENSION / renderHeight
        );
        renderWidth = Math.max(1, Math.floor(renderWidth * ratio));
        renderHeight = Math.max(1, Math.floor(renderHeight * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, renderWidth, renderHeight);
    return canvasToBlob(canvas);
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const readViewBox = root => {
    const value = root.getAttribute('viewBox');
    if (!value) return null;
    const parts = value.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some(part => !Number.isFinite(part))) return null;
    return {x: parts[0], y: parts[1], width: parts[2], height: parts[3]};
};

// Put an imported SVG into an existing costume without replacing its contents.
// The incoming artwork is centered at its natural size.
export const mergeSvgImages = (baseSvg, incomingSvg) => {
    try {
        const parser = new DOMParser();
        const baseDoc = parser.parseFromString(baseSvg, 'image/svg+xml');
        const incomingDoc = parser.parseFromString(incomingSvg, 'image/svg+xml');
        if (baseDoc.querySelector('parsererror') || incomingDoc.querySelector('parsererror')) {
            return baseSvg;
        }
        const baseRoot = baseDoc.documentElement;
        const incomingRoot = incomingDoc.documentElement;
        if (baseRoot.localName !== 'svg' || incomingRoot.localName !== 'svg') return baseSvg;

        const baseInfo = getSvgInfo(baseSvg);
        const incomingInfo = getSvgInfo(incomingSvg);
        const baseBox = readViewBox(baseRoot) || {
            x: 0,
            y: 0,
            width: baseInfo.width || 480,
            height: baseInfo.height || 360
        };
        const incomingBox = readViewBox(incomingRoot) || {
            x: 0,
            y: 0,
            width: incomingInfo.width || baseBox.width,
            height: incomingInfo.height || baseBox.height
        };
        if (!incomingBox.width || !incomingBox.height) return baseSvg;

        const offsetX = baseBox.x + ((baseBox.width - incomingBox.width) / 2);
        const offsetY = baseBox.y + ((baseBox.height - incomingBox.height) / 2);
        const group = baseDoc.createElementNS(SVG_NS, 'g');
        group.setAttribute(
            'transform',
            `translate(${offsetX - incomingBox.x} ${offsetY - incomingBox.y})`
        );
        for (const child of Array.from(incomingRoot.childNodes)) {
            if (child.nodeType === 1) group.appendChild(baseDoc.importNode(child, true));
        }
        if (!group.childNodes.length) return baseSvg;
        baseRoot.appendChild(group);
        return new XMLSerializer().serializeToString(baseRoot);
    } catch (error) {
        return baseSvg;
    }
};

export const blobToDataUrl = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('data-url-read-failed'));
    reader.readAsDataURL(blob);
});

// Compose a raster import over the existing bitmap at its natural size,
// centered in the current costume.
export const mergeBitmapImages = async (baseDataUrl, incomingDataUrl, width, height) => {
    const [base, incoming] = await Promise.all([loadImage(baseDataUrl), loadImage(incomingDataUrl)]);
    const canvasWidth = Math.max(1, Math.round(width || base.naturalWidth || 480));
    const canvasHeight = Math.max(1, Math.round(height || base.naturalHeight || 360));
    const widthRatio = incoming.naturalWidth / canvasWidth;
    const heightRatio = incoming.naturalHeight / canvasHeight;
    const fitScale = Math.min(1, 1 / Math.max(widthRatio, heightRatio, 1));
    const drawWidth = Math.max(1, incoming.naturalWidth * fitScale);
    const drawHeight = Math.max(1, incoming.naturalHeight * fitScale);
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext('2d');
    context.drawImage(base, 0, 0, canvasWidth, canvasHeight);
    context.drawImage(
        incoming,
        (canvasWidth - drawWidth) / 2,
        (canvasHeight - drawHeight) / 2,
        drawWidth,
        drawHeight
    );
    return canvas.toDataURL('image/png');
};

export const addXmlDeclaration = svg => {
    if (typeof svg !== 'string') throw new Error('invalid-svg');
    if (/^\s*<\?xml/i.test(svg)) return svg;
    return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
};
