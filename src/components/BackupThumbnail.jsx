import React, {useEffect, useState} from 'react';

const BackupThumbnail = ({doc, label}) => {
    const [preview, setPreview] = useState('');

    useEffect(() => {
        let cancelled = false;
        let objectUrl;
        let revokeTimer;
        const renderPreview = async () => {
            try {
                const image = new Image();
                if (doc.format === 'vector') {
                    const svg = new Blob([doc.image], {type: 'image/svg+xml;charset=utf-8'});
                    objectUrl = URL.createObjectURL(svg);
                    image.src = objectUrl;
                } else if (doc.imageFormat === 'png' || doc.imageFormat === 'jpg') {
                    image.src = doc.image;
                } else {
                    return;
                }
                await new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = reject;
                });
                if (cancelled) return;
                const canvas = document.createElement('canvas');
                canvas.width = 112;
                canvas.height = 72;
                const context = canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);
                const width = image.naturalWidth || image.width;
                const height = image.naturalHeight || image.height;
                if (!width || !height) return;
                const scale = Math.min((canvas.width - 8) / width, (canvas.height - 8) / height);
                const drawWidth = width * scale;
                const drawHeight = height * scale;
                context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
                setPreview(canvas.toDataURL('image/png'));
            } catch (error) {
                if (!cancelled) setPreview('');
            } finally {
                if (objectUrl) revokeTimer = window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
            }
        };
        renderPreview();
        return () => {
            cancelled = true;
            if (revokeTimer) window.clearTimeout(revokeTimer);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [doc.format, doc.image, doc.imageFormat]);

    return (
        <div aria-label={label} className="backup-thumbnail" role="img">
            {preview ? <img alt="" src={preview}/> : <span aria-hidden="true">▧</span>}
        </div>
    );
};

export default BackupThumbnail;
