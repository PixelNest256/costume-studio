export const sanitizeFilename = (name, fallback = 'costume') => {
    const cleaned = String(name || '')
        .replace(/[\u0000-\u001f\u007f]+/g, '')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/^\.+/, '')
        .trim()
        .slice(0, 64)
        .replace(/[. ]+$/, '');
    return cleaned || fallback;
};

export const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};
