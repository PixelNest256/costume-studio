import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import {updateIntl} from 'react-intl-redux';
import PaintEditor from '@scratch/scratch-paint';
import {inlineSvgFonts} from '@scratch/scratch-svg-renderer';

import BackupDialog from './components/BackupDialog.jsx';
import SvgCodePanel from './components/SvgCodePanel.jsx';
import ColorPalettePanel from './components/ColorPalettePanel.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import FeaturesMenu from './components/FeaturesMenu.jsx';
import HelpDialog from './components/HelpDialog.jsx';
import LegalNotices from './components/LegalNotices.jsx';
import FontManagerDialog from './components/FontManagerDialog.jsx';
import AppMenu, {AppMenuDivider, AppMenuItem} from './components/AppMenu.jsx';
import SaveMenu from './components/SaveMenu.jsx';
import {
    BitmapIcon,
    BrushIcon,
    FolderIcon,
    HistoryIcon,
    PaletteIcon,
    PlusIcon,
    VectorIcon
} from './components/Icons.jsx';
import {getMessages, rememberLocale, SUPPORTED_LOCALES} from './i18n.js';
import {addXmlDeclaration, bitmapToSvg, blobToDataUrl, getSvgInfo, imageDataToDataUrl, mergeBitmapImages, mergeSvgImages, pngToPngBlob, svgToPngBlob} from './lib/image.js';
import {FileReadError, readCostumeFile} from './lib/files.js';
import {downloadBlob, sanitizeFilename} from './lib/download.js';
import {clearAutosave, hasBackup, loadBackups, saveBackup} from './lib/storage.js';
import {convertCustomFontTextToPaths, embedCustomFontsInSvg} from './lib/custom-fonts.js';
import {loadFeatureState, saveFeatureState} from './lib/features.js';
import {changeFillColor} from './vendor/scratch-paint/reducers/fill-style.js';
import {changeStrokeColor} from './vendor/scratch-paint/reducers/stroke-style.js';
import {SAMPLE_NAME, SAMPLE_SVG} from './sample.js';

const PUBLIC_REPOSITORY_URL = 'https://github.com/PixelNest256/costume-studio';
const SOURCE_URL = PUBLIC_REPOSITORY_URL;
const LICENSE_URL = `${PUBLIC_REPOSITORY_URL}/blob/main/LICENSE`;
const SAMPLE_WIDTH = 300;
const SAMPLE_HEIGHT = 300;

const makeBlankDocument = (imageId, name) => ({
    name,
    image: undefined,
    imageId,
    zoomId: imageId,
    imageFormat: 'svg',
    format: 'vector',
    rotationCenterX: undefined,
    rotationCenterY: undefined,
    width: null,
    height: null
});

const BACKUP_INTERVAL_MS = 5 * 60 * 1000;

const createInitialState = () => {
    // No silent autosave/restore anymore: start blank every time. Work is
    // only kept when the user (or the periodic timer) saves a backup.
    // Remove any legacy autosave from older builds.
    clearAutosave();
    return {
        doc: makeBlankDocument('blank-0', 'costume1'),
        nextName: 2
    };
};

const App = () => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const locale = useSelector(state => state.intl.locale);
    const paintTheme = useSelector(state => state.scratchPaint && state.scratchPaint.theme);
    const activeLocale = SUPPORTED_LOCALES.includes(locale) ? locale : 'en';
    const appTheme = paintTheme === 'dark' ? 'dark' : 'light';
    const t = useCallback((id, defaultMessage) => intl.formatMessage({id, defaultMessage}), [intl]);

    useEffect(() => {
        try {
            if (paintTheme === 'dark' || paintTheme === 'light') {
                window.localStorage.setItem('costume-studio.theme', paintTheme);
            }
        } catch (error) {
            // ignore
        }
    }, [paintTheme]);

    const [initial] = useState(createInitialState);
    const [featurePrefs, setFeaturePrefsState] = useState(loadFeatureState);
    const [doc, setDoc] = useState(initial.doc);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [legalOpen, setLegalOpen] = useState(false);
    const [fontManagerOpen, setFontManagerOpen] = useState(false);
    const [codePanelOpen, setCodePanelOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [saveMenuRequest, setSaveMenuRequest] = useState(0);
    const [backupOpen, setBackupOpen] = useState(false);
    const [backups, setBackups] = useState(loadBackups);
    const [dragActive, setDragActive] = useState(false);
    const [toast, setToast] = useState(null);

    const fileInputRef = useRef(null);
    const importInputRef = useRef(null);
    const imageIdRef = useRef(1);
    const nextNameRef = useRef(initial.nextName);
    const dragDepthRef = useRef(0);
    const toastKeyRef = useRef(0);

    const nextImageId = useCallback(prefix => {
        imageIdRef.current += 1;
        return `${prefix}-${imageIdRef.current}`;
    }, []);

    const showToast = useCallback((id, values) => {
        toastKeyRef.current += 1;
        setToast({key: toastKeyRef.current, id, values});
    }, []);

    useEffect(() => {
        if (!toast) return undefined;
        const timer = window.setTimeout(() => setToast(null), 4500);
        return () => window.clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        document.title = `${doc.name || 'costume'} · Costume Studio`;
    }, [doc.name]);

    useEffect(() => {
        document.documentElement.lang = activeLocale;
    }, [activeLocale]);

    useEffect(() => {
        if (!dirty) return undefined;
        const handleBeforeUnload = event => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [dirty]);

    useEffect(() => {
        const preventFileDrop = event => {
            const types = event.dataTransfer && event.dataTransfer.types;
            if (types && Array.prototype.includes.call(types, 'Files')) {
                event.preventDefault();
            }
        };
        window.addEventListener('dragover', preventFileDrop);
        window.addEventListener('drop', preventFileDrop);
        return () => {
            window.removeEventListener('dragover', preventFileDrop);
            window.removeEventListener('drop', preventFileDrop);
        };
    }, []);

    const createBackup = useCallback((targetDoc, {silent = false} = {}) => {
        if (!targetDoc.image) {
            if (!silent) showToast('toast.empty');
            return false;
        }
        if (hasBackup(targetDoc)) {
            if (!silent) showToast('backup.duplicate');
            return false;
        }
        const result = saveBackup(targetDoc);
        if (result.ok) {
            setBackups(loadBackups());
            if (!silent) showToast('backup.saved');
            return true;
        }
        if (!silent) {
            showToast(result.reason === 'duplicate' ? 'backup.duplicate' :
                result.reason === 'too-large' ? 'backup.tooLarge' : 'backup.failed');
        }
        return false;
    }, [showToast]);

    const features = featurePrefs.enabled;

    // Periodic backup (restore point) every 5 minutes while there is
    // unsaved work. Silent: no toast spam.
    useEffect(() => {
        if (!dirty || !doc.image || !features.autoBackup) return undefined;
        const timer = window.setInterval(() => {
            createBackup(doc, {silent: true});
        }, BACKUP_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [dirty, doc, createBackup, features.autoBackup]);

    const handleRestoreBackup = useCallback(backupDoc => {
        setDoc({...backupDoc, imageId: nextImageId('backup'), zoomId: nextImageId('zoom')});
        setDirty(false);
        setBackupOpen(false);
        showToast('backup.restored', {name: backupDoc.name});
    }, [nextImageId, showToast]);

    const setFeaturePrefs = next => {
        setFeaturePrefsState(previous => {
            const state = typeof next === 'function' ? next(previous) : next;
            saveFeatureState(state);
            return state;
        });
    };

    const toggleFeature = id => {
        setFeaturePrefs(previous => ({
            ...previous,
            enabled: {...previous.enabled, [id]: !previous.enabled[id]}
        }));
    };

    const changeFeatureValue = (id, value) => {
        setFeaturePrefs(previous => ({
            ...previous,
            enabled: {...previous.enabled, [id]: value}
        }));
    };

    useEffect(() => {
        // The vendored canvas reads these settings directly from localStorage.
        // Notify it after React has persisted the new values.
        window.dispatchEvent(new Event('costume-studio:features-changed'));
    }, [featurePrefs]);

    const toggleLocale = () => {
        const nextLocale = activeLocale === 'ja' ? 'en' : 'ja';
        dispatch(updateIntl({locale: nextLocale, messages: getMessages(nextLocale)}));
        rememberLocale(nextLocale);
    };

    const handleUpdateName = useCallback(name => {
        setDoc(previous => (previous.name === name ? previous : {...previous, name}));
        setDirty(true);
    }, []);

    const handlePaletteApply = useCallback((color, target) => {
        // Keep the active fill/stroke color in sync even when nothing is
        // selected; the next drawing operation should use the chosen color.
        if (target === 'stroke') {
            dispatch(changeStrokeColor(color));
        } else {
            dispatch(changeFillColor(color));
        }
        window.dispatchEvent(new CustomEvent('costume-studio:palette-apply', {
            detail: {color, target}
        }));
    }, [dispatch]);

    const handleUpdateImage = useCallback((isVector, image, rotationCenterX, rotationCenterY) => {
        if (isVector) {
            if (!image) {
                setDoc(previous => ({
                    ...previous,
                    image: undefined,
                    imageFormat: 'svg',
                    format: 'vector',
                    rotationCenterX,
                    rotationCenterY,
                    width: null,
                    height: null
                }));
                setDirty(true);
                return;
            }

            const info = getSvgInfo(image);
            setDoc(previous => ({
                ...previous,
                image,
                imageFormat: 'svg',
                format: 'vector',
                rotationCenterX,
                rotationCenterY,
                width: info.width,
                height: info.height
            }));
            setDirty(true);
            return;
        }

        if (!image || !image.width || !image.height) return;
        const dataUrl = imageDataToDataUrl(image);
        setDoc(previous => ({
            ...previous,
            image: dataUrl,
            imageFormat: 'png',
            format: 'bitmap',
            rotationCenterX,
            rotationCenterY,
            width: image.width,
            height: image.height
        }));
        setDirty(true);
    }, []);

    const startNew = useCallback(() => {
        const name = `costume${nextNameRef.current++}`;
        const imageId = nextImageId('new');
        setDoc(makeBlankDocument(imageId, name));
        setDirty(false);
    }, [nextImageId]);

    const requestNew = useCallback(() => {
        if (dirty) {
            setConfirm({
                titleId: 'new.title',
                messageId: 'new.message',
                confirmId: 'actions.confirm',
                tone: 'danger',
                action: startNew
            });
        } else {
            startNew();
        }
    }, [dirty, startNew]);

    const startSample = useCallback(() => {
        const imageId = nextImageId('sample');
        setDoc({
            name: SAMPLE_NAME,
            image: SAMPLE_SVG,
            imageId,
            zoomId: imageId,
            imageFormat: 'svg',
            format: 'vector',
            rotationCenterX: SAMPLE_WIDTH / 2,
            rotationCenterY: SAMPLE_HEIGHT / 2,
            width: SAMPLE_WIDTH,
            height: SAMPLE_HEIGHT
        });
        setDirty(false);
        showToast('toast.sampleLoaded');
    }, [nextImageId, showToast]);

    const openFile = useCallback(async file => {
        if (!file) return;
        setBusy('open');
        try {
            const loaded = await readCostumeFile(file, {
                importFixes: true,
                importScale: true
            });
            const imageId = nextImageId('open');
            setDoc({...loaded, imageId, zoomId: nextImageId('zoom')});
            setDirty(false);
                    showToast('toast.loaded', {name: loaded.name});
        } catch (error) {
            const code = error instanceof FileReadError ? error.code : 'read-error';
            showToast(
                code === 'too-large' ? 'toast.tooLarge' :
                    code === 'unsupported' ? 'toast.unsupported' :
                        'toast.readError'
            );
        } finally {
            setBusy(null);
        }
    }, [nextImageId, showToast]);

    const importFile = useCallback(async file => {
        if (!file) return;
        setBusy('import');
        try {
            const loaded = await readCostumeFile(file, {
                importFixes: true,
                importScale: true
            });
            if (!doc.image) {
                const imageId = nextImageId('import');
                setDoc({
                    ...loaded,
                    name: doc.name || loaded.name,
                    imageId,
                    zoomId: nextImageId('zoom'),
                    rotationCenterX: undefined,
                    rotationCenterY: undefined
                });
                setDirty(true);
                showToast('toast.imported', {name: loaded.name});
                return;
            }

            const imageId = nextImageId('import');
            if (doc.format === 'vector') {
                const incomingSvg = loaded.format === 'vector' ?
                    loaded.image :
                    bitmapToSvg(loaded.image, loaded.width, loaded.height);
                const merged = mergeSvgImages(doc.image, incomingSvg);
                const info = getSvgInfo(merged);
                setDoc({
                    ...doc,
                    image: merged,
                    imageFormat: 'svg',
                    format: 'vector',
                    width: info.width || doc.width,
                    height: info.height || doc.height,
                    imageId
                });
            } else {
                let incomingDataUrl = loaded.image;
                if (loaded.format === 'vector') {
                    const blob = await svgToPngBlob(loaded.image, null, 1);
                    incomingDataUrl = await blobToDataUrl(blob);
                }
                const merged = await mergeBitmapImages(
                    doc.image,
                    incomingDataUrl,
                    doc.width || loaded.width,
                    doc.height || loaded.height
                );
                setDoc({
                    ...doc,
                    image: merged,
                    imageFormat: 'png',
                    format: 'bitmap',
                    width: doc.width || loaded.width,
                    height: doc.height || loaded.height,
                    imageId
                });
            }
            setDirty(true);
            showToast('toast.imported', {name: loaded.name});
        } catch (error) {
            const code = error instanceof FileReadError ? error.code : 'read-error';
            showToast(
                code === 'too-large' ? 'toast.tooLarge' :
                    code === 'unsupported' ? 'toast.unsupported' :
                        'toast.readError'
            );
        } finally {
            setBusy(null);
        }
    }, [doc, nextImageId, showToast]);

    const handleImportClick = useCallback(() => {
        if (busy) return;
        importInputRef.current?.click();
    }, [busy]);

    const handleImportFileChange = event => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (file) importFile(file);
    };

    // Set when the user already confirmed discarding changes to open a file,
    // so choosing the file does not prompt a second confirmation dialog.
    const skipOpenConfirmRef = useRef(false);

    const requestOpenFile = useCallback(file => {
        if (!file) return;
        if (skipOpenConfirmRef.current) {
            skipOpenConfirmRef.current = false;
            openFile(file);
            return;
        }
        if (dirty) {
            setConfirm({
                titleId: 'open.title',
                messageId: 'open.message',
                confirmId: 'actions.confirm',
                tone: 'danger',
                action: () => openFile(file)
            });
        } else {
            openFile(file);
        }
    }, [dirty, openFile]);

    const handleOpenClick = useCallback(() => {
        const chooseFile = () => {
            skipOpenConfirmRef.current = true;
            if (fileInputRef.current) fileInputRef.current.click();
        };
        if (dirty) {
            setConfirm({
                titleId: 'open.title',
                messageId: 'open.message',
                confirmId: 'actions.confirm',
                tone: 'danger',
                action: chooseFile
            });
        } else {
            chooseFile();
        }
    }, [dirty]);

    const requestSample = useCallback(() => {
        setHelpOpen(false);
        if (dirty) {
            setConfirm({
                titleId: 'sample.title',
                messageId: 'sample.message',
                confirmId: 'actions.confirm',
                tone: 'danger',
                action: startSample
            });
        } else {
            startSample();
        }
    }, [dirty, startSample]);

    const handleFileInputChange = event => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (file) requestOpenFile(file);
    };

    const handleTextConverted = useCallback(({converted, skipped, unsupported, noSelection}) => {
        if (unsupported) {
            showToast('font.vectorOnly');
            return;
        }
        if (noSelection) {
            showToast('font.noTextSelected');
            return;
        }
        if (!converted) {
            showToast(skipped ? 'font.exportPathsSkipped' : 'font.noMatchingText');
            return;
        }
        showToast(
            skipped ? 'font.pathsConvertedPartial' : 'font.pathsConverted',
            {count: converted}
        );
    }, [showToast]);

    const handleSave = useCallback(async kind => {
        if (!doc.image) {
            showToast('toast.empty');
            return;
        }
        if (busy) return;

        setBusy('save');
        try {
            const base = sanitizeFilename(doc.name);
            if (kind === 'paths') {
                const converted = await convertCustomFontTextToPaths(doc.image);
                if (!converted.converted) {
                    showToast(converted.skipped ? 'font.exportPathsSkipped' : 'font.noMatchingText');
                    return;
                }
                downloadBlob(
                    new Blob([addXmlDeclaration(converted.svg)], {type: 'image/svg+xml;charset=utf-8'}),
                    `${base}-text-paths.svg`
                );
                if (converted.skipped) showToast('font.exportPathsSkipped');
                else showToast('toast.saved', {format: 'SVG (text paths)'});
                return;
            }
            if (kind === 'svg') {
                let svg = doc.format === 'vector' ?
                    doc.image :
                    bitmapToSvg(doc.image, doc.width, doc.height);
                downloadBlob(
                    new Blob([addXmlDeclaration(svg)], {type: 'image/svg+xml;charset=utf-8'}),
                    `${base}.svg`
                );
                showToast('toast.saved', {format: 'SVG'});
            } else {
                const scale = kind === 'png2x' ? 2 : 1;
                let blob;
                if (doc.format === 'bitmap') {
                    blob = await pngToPngBlob(doc.image, scale);
                } else {
                    // The rasterizer loads the SVG as an isolated image, so
                    // imported FontFace data is not available inside it. Convert
                    // imported-font text to outlines first so the PNG keeps the
                    // intended typeface.
                    let vectorSvg = doc.image;
                    try {
                        const converted = await convertCustomFontTextToPaths(doc.image);
                        if (converted.converted) vectorSvg = converted.svg;
                        // Convertible text is now paths; for fonts that cannot
                        // be converted (WOFF/WOFF2 outlines), embed the font so
                        // the isolated rasterizer can still use it.
                        vectorSvg = embedCustomFontsInSvg(vectorSvg);
                    } catch (error) {
                        // Fall back to the original SVG; export still succeeds.
                    }
                    blob = await svgToPngBlob(vectorSvg, inlineSvgFonts, scale);
                }
                downloadBlob(blob, `${base}${scale === 2 ? '@2x' : ''}.png`);
                showToast('toast.saved', {format: scale === 2 ? 'PNG (2×)' : 'PNG'});
            }
            setDirty(false);
        } catch (error) {
            console.error(error);
            showToast('toast.saveError');
        } finally {
            setBusy(null);
        }
    }, [busy, doc, showToast]);

    useEffect(() => {
        const isEditable = target => (
            target &&
            (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        );

        const handleKeyDown = event => {
            if (event.key === '?' && !isEditable(event.target)) {
                event.preventDefault();
                setHelpOpen(true);
                return;
            }

            const modifier = event.ctrlKey || event.metaKey;
            if (!modifier || event.altKey) return;

            if (isEditable(event.target)) return;

            const key = event.key.toLowerCase();
            if (key === 's') {
                event.preventDefault();
                if (event.shiftKey) {
                    handleSave('svg');
                } else if (doc.image) {
                    // Ctrl/Cmd+S opens the save-format menu instead of
                    // silently choosing a format. SaveMenu focuses the first
                    // option (SVG vector), so arrows + Enter work immediately.
                    setSaveMenuRequest(value => value + 1);
                } else {
                    showToast('toast.empty');
                }
            } else if (key === 'o') {
                event.preventDefault();
                handleOpenClick();
            } else if (key === 'z' || key === 'y' || key === 'p' || key === 'f') {
                // Undo/redo/redo/print/find are handled by the paint editor
                // (keyboard-shortcuts-hoc) or must not trigger browser UI.
                // preventDefault here as well so the browser never hijacks them.
                event.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [doc.format, doc.image, handleOpenClick, handleSave, showToast]);

    const handleDragEnter = event => {
        const types = event.dataTransfer && event.dataTransfer.types;
        if (!types || !Array.prototype.includes.call(types, 'Files')) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragActive(true);
    };

    const handleDragOver = event => {
        const types = event.dataTransfer && event.dataTransfer.types;
        if (!types || !Array.prototype.includes.call(types, 'Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = event => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragActive(false);
    };

    const handleDrop = event => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setDragActive(false);
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) requestOpenFile(file);
    };

    const handleConfirm = () => {
        if (!confirm) return;
        const action = confirm.action;
        setConfirm(null);
        // Run synchronously so actions that open a file picker keep user activation.
        action();
    };

    const formatKey = doc.format === 'bitmap' ? 'status.bitmap' : 'status.vector';
    const sizeText = doc.width && doc.height ?
        `${Math.round(doc.width)} × ${Math.round(doc.height)} px` :
        null;
    const centerText = Number.isFinite(doc.rotationCenterX) && Number.isFinite(doc.rotationCenterY) ?
        `${Math.round(doc.rotationCenterX)}, ${Math.round(doc.rotationCenterY)}` :
        null;
    const backupLabel = backups.length ?
        intl.formatMessage({id: 'backup.count', defaultMessage: '{count} backups'}, {count: backups.length}) :
        t('backup.none', 'No backups yet');

    const helpDialog = helpOpen ? (
        <HelpDialog
            licenseUrl={LICENSE_URL}
            sourceUrl={SOURCE_URL}
            onClose={() => setHelpOpen(false)}
            onOpenSample={requestSample}
        />
    ) : null;

    return (
        <div
            className={`app${dragActive ? ' is-dragging' : ''}`}
            data-theme={appTheme}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <header className="appbar">
                <div className="brand">
                    <span className="brand-mark"><BrushIcon size={23}/></span>
                    <span className="brand-text">
                        <span className="brand-name">Costume Studio</span>
                        <span className="brand-tagline">{t('app.tagline', 'Scratch-style costume editor')}</span>
                    </span>
                </div>

                <div className="appbar-actions">
                    <AppMenu icon={FolderIcon} label={t('menu.file', 'File')}>
                        <AppMenuItem icon={PlusIcon} onClick={requestNew}>{t('actions.new', 'New')}</AppMenuItem>
                        <AppMenuItem disabled={Boolean(busy)} icon={FolderIcon} onClick={handleOpenClick}>{t('actions.open', 'Open')}</AppMenuItem>
                        <AppMenuDivider/>
                        <AppMenuItem disabled={Boolean(busy)} icon={PlusIcon} onClick={handleImportClick}>{t('actions.import', 'Import')}</AppMenuItem>
                    </AppMenu>
                    <AppMenu icon={HistoryIcon} label={t('menu.backup', 'Backups')}>
                        <AppMenuItem disabled={!doc.image} icon={PlusIcon} onClick={() => createBackup(doc)}>{t('backup.save', 'Save backup')}</AppMenuItem>
                        <AppMenuItem icon={FolderIcon} onClick={() => { setBackups(loadBackups()); setBackupOpen(true); }}>{t('backup.title', 'Backups')} ({backups.length})</AppMenuItem>
                    </AppMenu>
                    <FeaturesMenu
                        features={features}
                        onChangeValue={changeFeatureValue}
                        onToggle={toggleFeature}
                    />
                    <button
                        aria-label={t('code.title', 'SVG code')}
                        aria-pressed={codePanelOpen}
                        className={`button button-ghost${codePanelOpen ? ' is-active' : ''}`}
                        onClick={() => setCodePanelOpen(value => !value)}
                        title={t('code.title', 'SVG code')}
                        type="button"
                    >
                        <span className="action-label">{t('code.title', 'SVG code')}</span>
                    </button>
                    <button
                        aria-label={t('palette.title', 'Color palette')}
                        aria-pressed={paletteOpen}
                        className={`button button-ghost${paletteOpen ? ' is-active' : ''}`}
                        onClick={() => setPaletteOpen(value => !value)}
                        title={t('palette.title', 'Color palette')}
                        type="button"
                    >
                        <PaletteIcon size={18}/>
                        <span className="action-label">{t('palette.title', 'Color palette')}</span>
                    </button>
                    <SaveMenu
                        busy={busy}
                        canExportPaths={doc.format === 'vector'}
                        defaultKind={doc.format === 'bitmap' ? 'png' : 'svg'}
                        disabled={!doc.image}
                        onSave={handleSave}
                        openRequest={saveMenuRequest}
                    />
                </div>
            </header>

            <main className={`editor-shell${codePanelOpen ? ' with-code-panel' : ''}`} aria-busy={Boolean(busy)}>
                <div className="editor-zoom">
                    <PaintEditor
                        activeLocale={activeLocale}
                        fontInlineFn={inlineSvgFonts}
                        image={doc.image}
                        imageFormat={doc.imageFormat}
                        imageId={doc.imageId}
                        name={doc.name}
                        rotationCenterX={doc.rotationCenterX}
                        rotationCenterY={doc.rotationCenterY}
                        rtl={false}
                        zoomLevelId={`costume-studio-${doc.zoomId || doc.imageId}`}
                        onManageFonts={() => setFontManagerOpen(true)}
                        onTextConverted={handleTextConverted}
                        onToggleLanguage={toggleLocale}
                        onUpdateImage={handleUpdateImage}
                        onUpdateName={handleUpdateName}
                    />
                </div>
                <SvgCodePanel
                    onClose={() => setCodePanelOpen(false)}
                    t={t}
                    visible={codePanelOpen}
                />
                <ColorPalettePanel
                    onApplyColor={handlePaletteApply}
                    onClose={() => setPaletteOpen(false)}
                    visible={paletteOpen}
                />
            </main>

            <footer className="statusbar">
                <div className="statusbar-left">
                    <span>{t('status.local', 'Everything stays in your browser')}</span>
                    <button
                        aria-label={t('legal.open', 'About & legal notices')}
                        className="statusbar-legal-link"
                        onClick={() => setLegalOpen(true)}
                        title={t('legal.open', 'About & legal notices')}
                        type="button"
                    >
                        {t('legal.open', 'About & legal notices')}
                    </button>
                    <button
                        aria-label={t('actions.help', 'Help')}
                        className="statusbar-legal-link"
                        onClick={() => setHelpOpen(true)}
                        title={t('actions.help', 'Help')}
                        type="button"
                    >
                        {t('actions.help', 'Help')}
                    </button>
                </div>
                <div className="statusbar-center">
                    <span className="meta-item">
                        {doc.format === 'bitmap' ? <BitmapIcon size={14}/> : <VectorIcon size={14}/>}
                        {t(formatKey, '')}
                    </span>
                    {sizeText ? <span className="meta-item">{t('status.size', 'Size')}: {sizeText}</span> : null}
                    {centerText ? <span className="meta-item">{t('status.center', 'Rotation center')}: {centerText}</span> : null}
                </div>
                <div className="statusbar-right">
                    <span className="autosave">
                        <span className="status-dot"/>
                        {backupLabel}
                    </span>
                </div>
            </footer>

            <input
                accept=".svg,image/svg+xml,.png,image/png,.jpg,.jpeg,image/jpeg,.gif,image/gif"
                className="visually-hidden"
                onChange={handleFileInputChange}
                ref={fileInputRef}
                type="file"
            />
            <input
                accept=".svg,image/svg+xml,.png,image/png,.jpg,.jpeg,image/jpeg,.gif,image/gif"
                className="visually-hidden"
                onChange={handleImportFileChange}
                ref={importInputRef}
                type="file"
            />

            {dragActive ? (
                <div className="drop-overlay">
                    <div className="drop-card">
                        <FolderIcon size={44}/>
                        <strong>{t('drop.title', 'Drop a file here')}</strong>
                        <span>{t('drop.subtitle', 'SVG, PNG, or JPG')}</span>
                    </div>
                </div>
            ) : null}

            {toast ? (
                <div aria-live="polite" className="toast" key={toast.key} role="status">
                    {intl.formatMessage({id: toast.id, defaultMessage: ''}, toast.values)}
                </div>
            ) : null}

            {helpDialog}
            {fontManagerOpen ? <FontManagerDialog onClose={() => setFontManagerOpen(false)}/> : null}
            {legalOpen ? (
                <LegalNotices
                    licenseUrl={LICENSE_URL}
                    sourceUrl={SOURCE_URL}
                    onClose={() => setLegalOpen(false)}
                />
            ) : null}
            {backupOpen ? (
                <BackupDialog
                    backups={backups}
                    onClose={() => setBackupOpen(false)}
                    onRestore={handleRestoreBackup}
                    t={t}
                />
            ) : null}
            <ConfirmDialog
                confirm={confirm}
                onCancel={() => setConfirm(null)}
                onConfirm={handleConfirm}
            />
        </div>
    );
};

export default App;
