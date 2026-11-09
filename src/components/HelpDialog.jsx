import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import Modal from './Modal.jsx';
import {BitmapIcon, DownloadIcon, FolderIcon, SaveIcon, VectorIcon} from './Icons.jsx';

const SHORTCUTS = [
    ['help.shortcut.save', 'Ctrl / ⌘ + S'],
    ['help.shortcut.svg', 'Ctrl / ⌘ + Shift + S'],
    ['help.shortcut.open', 'Ctrl / ⌘ + O'],
    ['help.shortcut.undo', 'Ctrl / ⌘ + Z / Y / Shift + Z'],
    ['help.shortcut.clipboard', 'Ctrl / ⌘ + C / V / X'],
    ['help.shortcut.selectAll', 'Ctrl / ⌘ + A'],
    ['help.shortcut.delete', 'Delete / Backspace'],
    ['help.shortcut.nudge', 'Arrow keys / Shift + Arrow keys'],
    ['help.shortcut.view', 'Ctrl / ⌘ + 0  ·  Ctrl / ⌘ + Shift + 0'],
    ['help.shortcut.layer', 'Ctrl / ⌘ + ↑ / ↓  ·  Ctrl / ⌘ + Shift + ↑ / ↓'],
    ['help.shortcut.group', 'Ctrl / ⌘ + G  ·  Ctrl / ⌘ + Shift + G'],
    ['help.shortcut.flip', 'Shift + H / Shift + V'],
    ['help.shortcut.cycle', 'Tab / Shift + Tab'],
    ['help.shortcut.tools', 'S / A / B / E / F / T / L / C / R / P / Y / V / M'],
    ['help.shortcut.help', '?']
];

const HelpDialog = ({sourceUrl, licenseUrl, onClose, onOpenSample}) => {
    const intl = useIntl();
    const t = (id, defaultMessage) => intl.formatMessage({id, defaultMessage});

    const features = [
        ['help.feature.vector', VectorIcon],
        ['help.feature.bitmap', BitmapIcon],
        ['help.feature.files', FolderIcon],
        ['help.feature.export', DownloadIcon],
        ['help.feature.preciseTransform', SaveIcon],
        ['help.feature.fonts', SaveIcon],
        ['help.feature.workspace', SaveIcon],
        ['help.feature.autosave', SaveIcon]
    ];

    return (
        <Modal
            className="modal-help"
            footer={
                <>
                    <a
                        className="button button-link"
                        href={sourceUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        {t('help.viewSource', 'View source')}
                    </a>
                    <span className="modal-footer-spacer"/>
                    <button className="button" onClick={onClose} type="button">
                        {t('actions.close', 'Close')}
                    </button>
                    <button className="button button-primary" onClick={onOpenSample} type="button">
                        {t('actions.sample', 'Open sample')}
                    </button>
                </>
            }
            onClose={onClose}
            title={t('help.title', 'Help & shortcuts')}
        >
            <p className="help-intro">{t('help.intro', '')}</p>
            <p className="help-disclaimer">{t('help.note.trademark', '')}</p>

            <h3>{t('help.featuresTitle', 'What you can do')}</h3>
            <ul className="feature-list">
                {features.map(([id, FeatureIcon]) => (
                    <li key={id}>
                        <span className="feature-icon"><FeatureIcon size={17}/></span>
                        <span>{t(id, '')}</span>
                    </li>
                ))}
            </ul>

            <h3>{t('help.shortcutsTitle', 'Shortcuts')}</h3>
            <div className="shortcut-grid">
                {SHORTCUTS.map(([id, keys]) => (
                    <div className="shortcut-row" key={id}>
                        <span>{t(id, '')}</span>
                        <kbd>{keys}</kbd>
                    </div>
                ))}
            </div>

            <h3>{t('help.notesTitle', 'Good to know')}</h3>
            <ul className="note-list">
                <li>{t('help.note.local', '')}</li>
                <li>{t('help.note.autosave', '')}</li>
                <li>{t('help.note.license', '')}</li>
                <li>{t('help.note.legal', '')}</li>
                <li>{t('help.note.sources', '')}</li>
            </ul>

            <p className="help-credits">
                {t('help.credits', '')}{' '}
                <a href={licenseUrl} rel="noopener noreferrer" target="_blank">
                    {t('help.license', 'License')}
                </a>
            </p>
        </Modal>
    );
};

export default HelpDialog;
