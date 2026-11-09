import React, {useEffect, useRef, useState} from 'react';
import {ChevronDownIcon} from './Icons.jsx';

const AppMenu = ({label, menuLabel, icon: Icon, children}) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const menuRef = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = event => {
            if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
        };
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
                return;
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);
            if (!items.length) return;
            event.preventDefault();
            const current = items.indexOf(document.activeElement);
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            items[(current + delta + items.length) % items.length].focus();
        };
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        const focusTimer = window.setTimeout(() => {
            menuRef.current?.querySelector('[role="menuitem"]')?.focus();
        }, 0);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
            window.clearTimeout(focusTimer);
        };
    }, [open]);

    return (
        <div className="app-menu" ref={wrapRef}>
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={label}
                className="button button-ghost app-menu-trigger"
                onClick={() => setOpen(value => !value)}
                ref={triggerRef}
                title={label}
                type="button"
            >
                {Icon ? <Icon size={17}/> : null}
                <span className="action-label">{label}</span>
                <ChevronDownIcon className="app-menu-chevron" size={14}/>
            </button>
            {open ? (
                <div aria-label={menuLabel || label} className="app-menu-popover" ref={menuRef} role="menu">
                    {React.Children.map(children, child => child ? React.cloneElement(child, {
                        onClick: event => {
                            setOpen(false);
                            if (child.props.onClick) child.props.onClick(event);
                        },
                        onKeyDown: event => {
                            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                event.preventDefault();
                                const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') || []);
                                const index = items.indexOf(event.currentTarget);
                                const delta = event.key === 'ArrowDown' ? 1 : -1;
                                items[(index + delta + items.length) % items.length]?.focus();
                            }
                        }
                    }) : null)}
                </div>
            ) : null}
        </div>
    );
};

export const AppMenuItem = ({children, disabled = false, icon: Icon, onClick, destructive = false}) => (
    <button
        className={`app-menu-item${destructive ? ' is-destructive' : ''}`}
        disabled={disabled}
        onClick={onClick}
        role="menuitem"
        type="button"
    >
        {Icon ? <Icon className="app-menu-item-icon" size={16}/> : <span className="app-menu-item-icon-spacer"/>}
        <span>{children}</span>
    </button>
);

export const AppMenuDivider = () => <div className="app-menu-divider" role="separator"/>;

export default AppMenu;
