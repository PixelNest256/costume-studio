import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import Modal from './Modal.jsx';
import BackupThumbnail from './BackupThumbnail.jsx';
import {CloseIcon, TrashIcon} from './Icons.jsx';
import {deleteBackup} from '../lib/storage.js';

const formatDate = timestamp => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Restore-points dialog: list saved backups, restore or delete them.
const BackupDialog = ({backups, onClose, onRestore, t}) => {
    const intl = useIntl();
    const [list, setList] = useState(backups);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleDelete = id => {
        deleteBackup(id);
        setList(previous => previous.filter(entry => entry.id !== id));
        setConfirmDeleteId(null);
    };

    return (
        <Modal
            onClose={onClose}
            title={t('backup.title', 'Backups')}
        >
            {list.length === 0 ? (
                <p className="backup-empty">{t('backup.empty', 'No backups yet. Use the backup button to save a restore point.')}</p>
            ) : (
                <ul className="backup-list">
                    {list.map(entry => (
                        <li className="backup-item" key={entry.id}>
                            <BackupThumbnail doc={entry.doc} label={intl.formatMessage(
                                {id: 'backup.preview', defaultMessage: 'Preview of {name}'},
                                {name: entry.doc.name || 'costume'}
                            )}/>
                            <div className="backup-meta">
                                <strong>{entry.doc.name || 'costume'}</strong>
                                <small>
                                    {formatDate(entry.savedAt)}
                                    {entry.doc.width && entry.doc.height ? ` · ${Math.round(entry.doc.width)} × ${Math.round(entry.doc.height)}` : ''}
                                    {entry.doc.format === 'bitmap' ? ` · ${intl.formatMessage({id: 'status.bitmap', defaultMessage: 'Bitmap'})}` : ` · ${intl.formatMessage({id: 'status.vector', defaultMessage: 'Vector'})}`}
                                </small>
                            </div>
                            <div className="backup-actions">
                                <button
                                    className="button button-primary button-small"
                                    onClick={() => onRestore(entry.doc)}
                                    type="button"
                                >
                                    {t('backup.restore', 'Restore')}
                                </button>
                                {confirmDeleteId === entry.id ? (
                                    <>
                                        <button
                                            aria-label={t('backup.deleteConfirm', 'Delete?')}
                                            className="button backup-icon-button backup-icon-button-danger"
                                            onClick={() => handleDelete(entry.id)}
                                            title={t('backup.deleteConfirm', 'Delete?')}
                                            type="button"
                                        >
                                            <TrashIcon size={16}/>
                                        </button>
                                        <button
                                            aria-label={t('actions.cancel', 'Cancel')}
                                            className="button backup-icon-button"
                                            onClick={() => setConfirmDeleteId(null)}
                                            title={t('actions.cancel', 'Cancel')}
                                            type="button"
                                        >
                                            <CloseIcon size={16}/>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="button button-ghost button-small"
                                        onClick={() => setConfirmDeleteId(entry.id)}
                                        type="button"
                                    >
                                        {t('backup.delete', 'Delete')}
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
};

export default BackupDialog;
