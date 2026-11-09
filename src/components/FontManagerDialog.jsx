import React, {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import Modal from './Modal.jsx';
import {CloseIcon, PlusIcon, TrashIcon} from './Icons.jsx';
import {
    addSystemFont,
    FALLBACK_FAMILIES,
    getCustomFonts,
    importCustomFontFile,
    removeCustomFont,
    CUSTOM_FONTS_CHANGED_EVENT
} from '../lib/custom-fonts.js';

const FontManagerDialog = ({onClose}) => {
    const intl = useIntl();
    const [fonts, setFonts] = useState(getCustomFonts());
    const [name, setName] = useState('');
    const [fallback, setFallback] = useState('Sans Serif');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const fileInput = useRef(null);
    const t = (id, defaultMessage) => intl.formatMessage({id, defaultMessage});
    const fallbackOptions = Array.from(new Set([
        ...FALLBACK_FAMILIES,
        ...fonts.map(font => font.family),
        fallback
    ]));

    useEffect(() => {
        const refresh = () => setFonts(getCustomFonts());
        refresh();
        window.addEventListener(CUSTOM_FONTS_CHANGED_EVENT, refresh);
        return () => window.removeEventListener(CUSTOM_FONTS_CHANGED_EVENT, refresh);
    }, []);

    const errorMessage = reason => {
        switch (reason && reason.message) {
        case 'font-too-large':
            return t('font.errorTooLarge', 'Font files must be 15 MB or smaller.');
        case 'font-unsupported':
            return t('font.errorUnsupported', 'Choose a TTF, OTF, WOFF, or WOFF2 font file.');
        case 'font-limit':
            return t('font.errorLimit', 'You can store up to 20 custom fonts.');
        case 'font-name-required':
            return t('font.errorNameRequired', 'Enter a font name.');
        case 'font-storage-unavailable':
        case 'font-storage-failed':
            return t('font.errorStorage', 'Could not update local font storage.');
        default:
            return t('font.errorInvalid', 'This font could not be read.');
        }
    };

    const handleFiles = async event => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length) return;
        setBusy(true);
        setError('');
        try {
            for (const file of files) {
                await importCustomFontFile(file, {
                    name: name || undefined,
                    fallback
                });
            }
            setName('');
            setFonts(getCustomFonts());
        } catch (reason) {
            setError(errorMessage(reason));
        } finally {
            setBusy(false);
        }
    };

    const handleAddSystemFont = async () => {
        if (!name.trim()) {
            setError(t('font.errorNameRequired', 'Enter a font name.'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            await addSystemFont(name, fallback);
            setName('');
            setFonts(getCustomFonts());
        } catch (reason) {
            setError(errorMessage(reason));
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async id => {
        try {
            await removeCustomFont(id);
            setFonts(getCustomFonts());
        } catch (reason) {
            setError(t('font.errorStorage', 'Could not update local font storage.'));
        }
    };

    return (
        <Modal className="font-manager-modal" onClose={onClose} title={t('font.managerTitle', 'Add more fonts')}>
            <p className="modal-message">
                {t('font.managerDescription', 'Add a font from a file on this device, or a font already installed on this device. Fonts are stored in this browser and are not uploaded.')}
            </p>

            <div className="font-form">
                <div className="font-form-row">
                    <label className="font-field">
                        <span>{t('font.name', 'Font name')}</span>
                        <input
                            onChange={event => setName(event.target.value)}
                            placeholder={t('font.namePlaceholder', 'Optional for font files')}
                            type="text"
                            value={name}
                        />
                    </label>
                    <label className="font-field">
                        <span>{t('font.fallback', 'Fallback font')}</span>
                        <select onChange={event => setFallback(event.target.value)} value={fallback}>
                            {fallbackOptions.map(family => (
                                <option key={family} value={family}>{family}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <p className="font-hint">
                    {t('font.fallbackHint', 'The fallback is used when the imported font cannot be loaded.')}
                </p>
                <div className="font-form-actions">
                    <button
                        className="button button-primary"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                        type="button"
                    >
                        <PlusIcon size={16}/>
                        {busy ? t('font.importing', 'Adding…') : t('font.addFile', 'Add font from a file…')}
                    </button>
                    <button
                        className="button button-ghost"
                        disabled={busy}
                        onClick={handleAddSystemFont}
                        type="button"
                    >
                        {t('font.addSystem', 'Add system font')}
                    </button>
                    <span className="font-manager-limit">
                        {t('font.storageHint', 'TTF, OTF, WOFF, WOFF2 · local to this browser')}
                    </span>
                </div>
            </div>

            {error ? <p className="font-manager-error" role="alert">{error}</p> : null}

            <h3 className="font-list-title">{t('font.listTitle', 'Added fonts')}</h3>
            {fonts.length ? (
                <ul className="font-manager-list">
                    {fonts.map(font => (
                        <li className="font-manager-item" key={font.id}>
                            <span className="font-manager-preview" style={{fontFamily: `"${font.family}"`}}>
                                {font.name}
                            </span>
                            <span className="font-manager-meta">
                                {font.system ? t('font.systemBadge', 'System') : t('font.fileBadge', 'File')}
                                {' · '}
                                {intl.formatMessage(
                                    {id: 'font.fallbackShort', defaultMessage: 'Fallback: {name}'},
                                    {name: font.fallback}
                                )}
                            </span>
                            <button
                                aria-label={intl.formatMessage({id: 'font.remove', defaultMessage: 'Remove {name}'}, {name: font.name})}
                                className="button backup-icon-button backup-icon-button-danger"
                                onClick={() => handleRemove(font.id)}
                                title={intl.formatMessage({id: 'font.remove', defaultMessage: 'Remove {name}'}, {name: font.name})}
                                type="button"
                            >
                                <TrashIcon size={16}/>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="font-manager-empty">{t('font.empty', 'No custom fonts yet.')}</p>
            )}

            <input
                accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                className="visually-hidden"
                multiple
                onChange={handleFiles}
                ref={fileInput}
                type="file"
            />
            <footer className="font-manager-footer">
                <button className="button button-ghost" onClick={onClose} type="button">
                    <CloseIcon size={16}/>{t('actions.close', 'Close')}
                </button>
            </footer>
        </Modal>
    );
};

export default FontManagerDialog;
