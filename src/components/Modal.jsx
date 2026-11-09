import React, {useEffect, useId, useRef} from 'react';
import {createPortal} from 'react-dom';
import {useIntl} from 'react-intl';
import {CloseIcon} from './Icons.jsx';

const Modal = ({children, className = '', footer, onClose, title}) => {
    const intl = useIntl();
    const titleId = useId();
    const dialogRef = useRef(null);
    const previousFocusRef = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        previousFocusRef.current = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        if (dialogRef.current) dialogRef.current.focus();

        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onCloseRef.current();
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            document.body.style.overflow = previousOverflow;
            if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
                previousFocusRef.current.focus();
            }
        };
    }, []);

    const closeLabel = intl.formatMessage({id: 'actions.close', defaultMessage: 'Close'});

    return createPortal(
        <div
            className="modal-backdrop"
            onMouseDown={event => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                aria-labelledby={titleId}
                aria-modal="true"
                className={`modal ${className}`}
                ref={dialogRef}
                role="dialog"
                tabIndex={-1}
            >
                <div className="modal-header">
                    <h2 id={titleId}>{title}</h2>
                    <button
                        aria-label={closeLabel}
                        className="icon-button modal-close"
                        onClick={onClose}
                        title={closeLabel}
                        type="button"
                    >
                        <CloseIcon size={18}/>
                    </button>
                </div>
                <div className="modal-body">{children}</div>
                {footer ? <div className="modal-footer">{footer}</div> : null}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
