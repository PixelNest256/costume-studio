import React from 'react';
import {useIntl} from 'react-intl';
import Modal from './Modal.jsx';

const ConfirmDialog = ({confirm, onCancel, onConfirm}) => {
    const intl = useIntl();
    if (!confirm) return null;

    const cancelLabel = intl.formatMessage({id: 'actions.cancel', defaultMessage: 'Cancel'});
    const confirmLabel = intl.formatMessage({
        id: confirm.confirmId || 'actions.confirm',
        defaultMessage: 'Continue'
    });

    return (
        <Modal
            className="modal-confirm"
            footer={
                <>
                    <button className="button" onClick={onCancel} type="button">
                        {cancelLabel}
                    </button>
                    <button
                        autoFocus
                        className="button button-primary"
                        onClick={onConfirm}
                        type="button"
                    >
                        {confirmLabel}
                    </button>
                </>
            }
            onClose={onCancel}
            title={intl.formatMessage({id: confirm.titleId, defaultMessage: 'Confirm'})}
        >
            <p className="modal-message">
                {intl.formatMessage({id: confirm.messageId, defaultMessage: ''})}
            </p>
        </Modal>
    );
};

export default ConfirmDialog;
