import React from 'react';
import {useIntl} from 'react-intl';
import Modal from './Modal.jsx';

const LegalNotices = ({onClose, sourceUrl, licenseUrl}) => {
    const intl = useIntl();
    const t = (id, defaultMessage) => intl.formatMessage({id, defaultMessage});

    return (
        <Modal
            className="modal-help"
            onClose={onClose}
            title={t('legal.title', 'About & legal notices')}
        >
            <h3>{t('legal.name', 'Costume Studio')}</h3>
            <p className="modal-message">
                {t('legal.copyright', 'Copyright © 2026 Costume Studio contributors.')}
            </p>
            <p className="modal-message">
                {t('legal.noWarranty', 'This program is provided without warranty. See the license for details.')}
            </p>
            <p className="modal-message">
                {t('legal.permissions', 'You may copy, modify, and redistribute the program under AGPL-3.0-only. When a modified version is offered for remote network interaction, users must be offered an opportunity to obtain its corresponding source.')}
            </p>
            <p className="modal-message">
                <a href={licenseUrl} rel="noopener noreferrer" target="_blank">
                    {t('help.license', 'License (AGPL-3.0-only)')}
                </a>
                {' · '}
                <a href={sourceUrl} rel="noopener noreferrer" target="_blank">
                    {t('help.viewSource', 'View source code')}
                </a>
                {' · '}
                <a href={`${sourceUrl}/blob/main/THIRD_PARTY_NOTICES.md`} rel="noopener noreferrer" target="_blank">
                    {t('legal.thirdParty', 'Third-party notices')}
                </a>
                {' · '}
                <a href="THIRD_PARTY_LICENSES.txt" rel="noopener noreferrer" target="_blank">
                    {t('legal.thirdPartyTexts', 'Third-party license texts')}
                </a>
            </p>
            <h3>{t('legal.credits', 'Credits and references')}</h3>
            <p className="modal-message">
                {t('legal.scratchPaint', 'Scratch Paint, Scratch SVG Renderer, Scratch localization, and Paper.js are open-source components used by this app.')}
            </p>
            <p className="modal-message">
                {t('legal.inspiration', 'Some independently implemented editor features were informed by TurboWarp, PenguinMod, and Scratch Addons. Their source is not bundled as a dependency; see Third-party notices for details.')}
            </p>
            <p className="modal-message">
                {t('legal.fontNotice', 'Font redistribution terms vary. The Scratch display font is omitted from this build because its upstream package says it is not redistributable.')}
            </p>
            <p className="modal-message">
                {t('help.note.trademark', 'Scratch is a trademark of the Scratch Foundation. This is an unofficial tool and is not affiliated with or endorsed by Scratch.')}
            </p>
        </Modal>
    );
};

export default LegalNotices;
