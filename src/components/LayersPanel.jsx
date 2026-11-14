import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {CloseIcon} from './Icons.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import styles from './LayersPanel.css';

const EyeIcon = ({open}) => (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 20 20" width="18">
        <path
            d="M1.5 10s3.1-5.2 8.5-5.2 8.5 5.2 8.5 5.2-3.1 5.2-8.5 5.2S1.5 10 1.5 10Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
        />
        <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6"/>
        {open ? null : (
            <path d="m3 3 14 14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/>
        )}
    </svg>
);

const LayersPanel = ({visible, onClose}) => {
    const intl = useIntl();
    const t = (id, defaultMessage, values) => intl.formatMessage({id, defaultMessage}, values);
    const [state, setState] = useState({
        layers: [],
        activeLayerId: null,
        inactiveDisplay: 'dim'
    });
    const [editingLayerId, setEditingLayerId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);
    const [draggedLayerId, setDraggedLayerId] = useState(null);

    const dispatchHover = id => {
        window.dispatchEvent(new CustomEvent('costume-studio:layers-hover', {
            detail: {id}
        }));
    };

    useEffect(() => {
        if (!visible) return undefined;
        const receive = event => {
            if (event.detail) setState(event.detail);
        };
        const request = () => {
            window.dispatchEvent(new CustomEvent('costume-studio:layers-request'));
        };
        window.addEventListener('costume-studio:layers-state', receive);
        request();
        const timer = window.setInterval(request, 1000);
        return () => {
            window.removeEventListener('costume-studio:layers-state', receive);
            window.clearInterval(timer);
            dispatchHover(null);
        };
    }, [visible]);

    if (!visible) return null;

    const action = (type, detail = {}) => {
        window.dispatchEvent(new CustomEvent('costume-studio:layers-action', {
            detail: {type, ...detail}
        }));
    };
    const close = () => {
        dispatchHover(null);
        setEditingLayerId(null);
        setPendingDelete(null);
        onClose();
    };
    const startEditing = layer => {
        setEditingLayerId(layer.id);
        setEditingName(layer.name);
    };
    const commitEditing = () => {
        if (editingLayerId) {
            action('rename', {id: editingLayerId, name: editingName});
        }
        setEditingLayerId(null);
    };
    const cancelEditing = () => {
        setEditingLayerId(null);
    };
    const handleDrop = (targetLayer, event) => {
        event.preventDefault();
        const sourceId = draggedLayerId || event.dataTransfer.getData('text/plain');
        setDraggedLayerId(null);
        if (!sourceId || sourceId === targetLayer.id) return;
        const display = state.layers.slice().reverse();
        const sourceIndex = display.findIndex(layer => layer.id === sourceId);
        const targetIndex = display.findIndex(layer => layer.id === targetLayer.id);
        if (sourceIndex < 0 || targetIndex < 0) return;
        const [source] = display.splice(sourceIndex, 1);
        // Dropping on a row moves the dragged layer to that row's position.
        // When dragging downward the target index shifts after removal.
        const insertion = sourceIndex < targetIndex ? targetIndex : targetIndex;
        display.splice(Math.min(insertion, display.length), 0, source);
        action('reorder', {ids: display.slice().reverse().map(layer => layer.id)});
    };
    const displayLayers = state.layers.slice().reverse();
    const displayMode = state.inactiveDisplay || 'dim';

    return (
        <>
            <aside aria-label={t('layers.title', 'Layers')} className={styles.layersPanel}>
                <header className={styles.layersHead}>
                    <div>
                        <strong>{t('layers.title', 'Layers')}</strong>
                        <small>{t('layers.hint', 'Only the active layer can be edited')}</small>
                    </div>
                    <button aria-label={t('actions.close', 'Close')} className="icon-button" onClick={close} type="button">
                        <CloseIcon size={18}/>
                    </button>
                </header>
                <div className={styles.layersActions}>
                    <button className="button button-small button-ghost" onClick={() => action('add')} type="button">
                        + {t('layers.add', 'New layer')}
                    </button>
                </div>
                <div aria-label={t('layers.inactiveDisplay', 'Non-active layers')} className={styles.displayModes} role="group">
                    <span>{t('layers.inactiveDisplay', 'Non-active layers')}</span>
                    {[
                        ['opaque', t('layers.opaque', 'Opaque')],
                        ['dim', t('layers.dim', 'Translucent')],
                        ['hidden', t('layers.hidden', 'Hidden')]
                    ].map(([mode, label]) => (
                        <button
                            aria-pressed={displayMode === mode}
                            className={displayMode === mode ? styles.displayModeSelected : styles.displayMode}
                            key={mode}
                            onClick={() => action('inactive-display', {mode})}
                            type="button"
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className={styles.layersList}>
                    {displayLayers.map(layer => {
                        const active = layer.id === state.activeLayerId;
                        const editing = editingLayerId === layer.id;
                        return (
                            <div
                                className={`${styles.layerRow}${active ? ` ${styles.isActive}` : ''}`}
                                key={layer.id}
                                onDragOver={event => event.preventDefault()}
                                onDrop={event => handleDrop(layer, event)}
                                onMouseEnter={() => dispatchHover(layer.id)}
                                onMouseLeave={() => dispatchHover(null)}
                            >
                                <button
                                    aria-label={t('layers.dragToReorder', 'Drag to reorder layer')}
                                    className={styles.layerDragHandle}
                                    draggable
                                    onDragEnd={() => setDraggedLayerId(null)}
                                    onDragStart={event => {
                                        setDraggedLayerId(layer.id);
                                        event.dataTransfer.effectAllowed = 'move';
                                        event.dataTransfer.setData('text/plain', layer.id);
                                    }}
                                    title={t('layers.dragToReorder', 'Drag to reorder layer')}
                                    type="button"
                                >
                                    ⠿
                                </button>
                                <div className={styles.layerNameBlock}>
                                    <button
                                        aria-label={t('layers.editName', 'Edit layer name')}
                                        className={styles.layerEdit}
                                        onClick={() => (editing ? commitEditing() : startEditing(layer))}
                                        title={t('layers.editName', 'Edit layer name')}
                                        type="button"
                                    >
                                        ✎
                                    </button>
                                    {editing ? (
                                        <div className={styles.layerNameEditor}>
                                            <input
                                                aria-label={t('layers.name', 'Layer name')}
                                                autoFocus
                                                onBlur={commitEditing}
                                                onChange={event => setEditingName(event.target.value)}
                                                onKeyDown={event => {
                                                    if (event.key === 'Enter') event.currentTarget.blur();
                                                    if (event.key === 'Escape') cancelEditing();
                                                }}
                                                value={editingName}
                                            />
                                            <small>{t('layers.itemCount', '{count} objects', {count: layer.itemCount || 0})}</small>
                                        </div>
                                    ) : (
                                        <button
                                            className={styles.layerSelect}
                                            onClick={() => action('active', {id: layer.id})}
                                            title={t('layers.makeActive', 'Make active')}
                                            type="button"
                                        >
                                            <span className={styles.layerName}>{layer.name}</span>
                                            <small>{t('layers.itemCount', '{count} objects', {count: layer.itemCount || 0})}</small>
                                        </button>
                                    )}
                                </div>
                                <button
                                    aria-label={layer.visible === false ?
                                        t('layers.show', 'Show layer') :
                                        t('layers.hide', 'Hide layer')}
                                    aria-pressed={layer.visible !== false}
                                    className={styles.layerVisibility}
                                    onClick={() => action('visible', {id: layer.id, visible: layer.visible === false})}
                                    title={layer.visible === false ? t('layers.show', 'Show layer') : t('layers.hide', 'Hide layer')}
                                    type="button"
                                >
                                    <EyeIcon open={layer.visible !== false}/>
                                </button>
                                <button
                                    aria-label={t('layers.moveHere', 'Move selection here')}
                                    className={styles.layerMoveSelection}
                                    onClick={() => action('move-selection-to', {id: layer.id})}
                                    title={t('layers.moveHere', 'Move selection here')}
                                    type="button"
                                >
                                    →
                                </button>
                                <button
                                    aria-label={t('layers.delete', 'Delete layer')}
                                    className={styles.layerDelete}
                                    disabled={state.layers.length <= 1}
                                    onClick={() => setPendingDelete(layer)}
                                    title={t('layers.deleteHint', 'Delete this layer; its objects move to the adjacent layer')}
                                    type="button"
                                >
                                    ×
                                </button>
                            </div>
                        );
                    })}
                </div>
                {!state.layers.length ? (
                    <p className={styles.layersEmpty}>{t('layers.empty', 'Open a vector costume to manage layers.')}</p>
                ) : null}
            </aside>
            <ConfirmDialog
                confirm={pendingDelete ? {
                    titleId: 'layers.deleteTitle',
                    messageId: 'layers.deleteMessage',
                    confirmId: 'layers.deleteConfirm'
                } : null}
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => {
                    if (pendingDelete) action('remove', {id: pendingDelete.id});
                    setPendingDelete(null);
                }}
            />
        </>
    );
};

export default LayersPanel;
