import React, {useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {ChevronDownIcon, SaveIcon} from './Icons.jsx';
import {formatShortcut} from '../lib/shortcuts.js';

// Split save control: the main button performs the current costume's default
// export, while the caret opens the full list of export formats.
const SaveMenu = ({busy, canExportPaths = true, defaultKind = 'svg', disabled, onSave, openRequest = 0}) => {
    const intl = useIntl();
    const t = (id, defaultMessage) => intl.formatMessage({id, defaultMessage});
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const menuRef = useRef(null);
    const isDisabled = Boolean(busy) || disabled;

    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = event => {
            if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
        };
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                setOpen(false);
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || []);
                if (!items.length) return;
                event.preventDefault();
                const current = items.indexOf(document.activeElement);
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                items[(current + delta + items.length) % items.length]?.focus();
            }
        };
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => {
            menuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        if (!openRequest || isDisabled) return;
        setOpen(true);
        // If the menu was already open, make sure keyboard focus lands on
        // the default SVG (vector) option again.
        const timer = window.setTimeout(() => {
            menuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [openRequest]); // only a new shortcut request should open the menu

    const options = [
        {kind: 'svg', label: t('save.svg', 'SVG'), hint: t('save.svgHint', 'Scalable vector artwork')},
        {
            kind: 'paths',
            label: t('save.paths', 'SVG (text as paths)'),
            hint: t('save.pathsHint', 'Convert text to paths'),
            disabled: !canExportPaths
        },
        {kind: 'png', label: t('save.png1x', 'PNG (1×)'), hint: t('save.png1xHint', 'Current pixel size')},
        {kind: 'png2x', label: t('save.png2x', 'PNG (2×)'), hint: t('save.png2xHint', 'Higher resolution')}
    ];

    return (
        <div className="save-menu" ref={wrapRef}>
            <button
                className="button button-primary save-main"
                data-shortcut={formatShortcut('Ctrl+S')}
                disabled={isDisabled}
                onClick={() => onSave(defaultKind)}
                title={t('save.shortcut', 'Ctrl/Cmd+S')}
                type="button"
            >
                <SaveIcon size={17}/>
                <span className="action-label">
                    {busy === 'save' ? t('status.saving', 'Saving…') : t('actions.save', 'Save')}
                </span>
            </button>
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={t('actions.saveMenu', 'Choose export format')}
                className="button button-primary save-caret"
                disabled={isDisabled}
                onClick={() => setOpen(value => !value)}
                title={t('actions.saveMenu', 'Choose export format')}
                type="button"
            >
                <ChevronDownIcon size={16}/>
            </button>
            {open ? (
                <div aria-label={t('actions.saveMenu', 'Choose export format')} className="save-menu-popover" role="menu" ref={menuRef}>
                    {options.map(option => (
                        <button
                            className="save-menu-item"
                            disabled={option.disabled}
                            key={option.kind}
                            onClick={() => {
                                setOpen(false);
                                onSave(option.kind);
                            }}
                            role="menuitem"
                            type="button"
                        >
                            <span className="save-menu-item-label">{option.label}</span>
                            <small>{option.hint}</small>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export default SaveMenu;
