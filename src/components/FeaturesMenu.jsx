import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {SlidersIcon, CloseIcon} from './Icons.jsx';

const Switch = ({checked, onToggle, label}) => (
    <button
        aria-checked={checked}
        aria-label={label}
        className={`feature-switch${checked ? ' is-on' : ''}`}
        onClick={onToggle}
        role="switch"
        type="button"
    >
        <span className="feature-switch-thumb"/>
    </button>
);

const NumberSettingRow = ({features, onChangeValue, t, id, labelKey, min, max, step = 1}) => (
    <label className="feature-number-row">
        <span className="feature-row-text">
            <strong>{t(labelKey, id)}</strong>
        </span>
        <input
            className="feature-number-input"
            max={max}
            min={min}
            onChange={event => onChangeValue(id, Number(event.target.value))}
            step={step}
            type="number"
            value={features[id]}
        />
    </label>
);

const SettingRow = ({features, onToggle, t, id, labelKey, hintKey}) => (
    <div className="feature-setting">
        <span className="feature-row-text">
            <strong>{t(labelKey, id)}</strong>
            {hintKey ? <small>{t(hintKey, '')}</small> : null}
        </span>
        <Switch
            checked={Boolean(features[id])}
            label={t(labelKey, id)}
            onToggle={() => onToggle(id)}
        />
    </div>
);

// Large settings dialog (about 75% of the viewport). The snap settings that
// used to be a long flat list are grouped into a card with subsections so
// they can be scanned quickly.
const FeaturesMenu = ({features, onChangeValue, onToggle}) => {
    const intl = useIntl();
    const t = (id, defaultMessage) => intl.formatMessage({id, defaultMessage});
    const [open, setOpen] = useState(false);
    const [snapExpanded, setSnapExpanded] = useState(true);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = event => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    const snapTo = [
        ['snapPageCenter', 'features.snapPageCenter'],
        ['snapPageAxes', 'features.snapPageAxes'],
        ['snapPageEdges', 'features.snapPageEdges'],
        ['snapPageCorners', 'features.snapPageCorners'],
        ['snapObjectEdges', 'features.snapObjectEdges'],
        ['snapObjectCenters', 'features.snapObjectCenters'],
        ['snapObjectMidlines', 'features.snapObjectMidlines'],
        ['snapObjectCorners', 'features.snapObjectCorners']
    ];
    const snapFrom = [
        ['snapBoxCenter', 'features.snapBoxCenter'],
        ['snapBoxCorners', 'features.snapBoxCorners'],
        ['snapBoxEdgeMids', 'features.snapBoxEdgeMids']
    ];

    return (
        <>
            <button
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={t('features.title', 'Features')}
                className="button button-ghost features-toggle"
                onClick={() => setOpen(true)}
                title={t('features.title', 'Features')}
                type="button"
            >
                <SlidersIcon size={18}/>
                <span className="action-label">{t('features.title', 'Features')}</span>
            </button>

            {open ? (
                <div className="features-modal-backdrop" onClick={() => setOpen(false)} role="presentation">
                    <div
                        aria-label={t('features.title', 'Features')}
                        aria-modal="true"
                        className="features-dialog"
                        onClick={event => event.stopPropagation()}
                        role="dialog"
                    >
                        <header className="features-dialog-head">
                            <div className="features-dialog-title">
                                <span className="features-dialog-icon"><SlidersIcon size={22}/></span>
                                <div>
                                    <strong>{t('features.title', 'Features')}</strong>
                                    <small>{t('features.hint', 'Editor settings')}</small>
                                </div>
                            </div>
                            <div className="features-dialog-head-actions">
                                <button
                                    aria-label={t('features.close', 'Close')}
                                    className="icon-button features-close"
                                    onClick={() => setOpen(false)}
                                    type="button"
                                >
                                    <CloseIcon size={20}/>
                                </button>
                            </div>
                        </header>

                        <div className="features-dialog-body">
                            <section className="features-card">
                                <div className="feature-setting feature-setting-main">
                                    <div className="feature-setting-main-text">
                                        <button
                                            aria-expanded={snapExpanded}
                                            aria-label={t('features.snapSub', 'Snap details')}
                                            className="feature-disclosure"
                                            disabled={!features.snap}
                                            onClick={() => setSnapExpanded(value => !value)}
                                            type="button"
                                        >
                                            {snapExpanded ? '▾' : '▸'}
                                        </button>
                                        <span className="feature-row-text">
                                            <strong>{t('features.snap', 'Snap to grid')}</strong>
                                            <small>{t('features.snapHint', '')}</small>
                                        </span>
                                    </div>
                                    <Switch
                                        checked={Boolean(features.snap)}
                                        label={t('features.snap', 'Snap to grid')}
                                        onToggle={() => onToggle('snap')}
                                    />
                                </div>

                                {features.snap && snapExpanded ? (
                                    <div className="feature-snap-details">
                                        <SettingRow
                                            features={features}
                                            onToggle={onToggle}
                                            t={t}
                                            id="snapCtrlDisable"
                                            labelKey="features.snapCtrlDisable"
                                            hintKey="features.snapCtrlDisableHint"
                                        />
                                        <SettingRow
                                            features={features}
                                            onToggle={onToggle}
                                            t={t}
                                            id="snapTextToPath"
                                            labelKey="features.snapTextToPath"
                                            hintKey="features.snapTextToPathHint"
                                        />
                                        <h3 className="feature-subsection-title">{t('features.groupSnapTo', 'Snap targets')}</h3>
                                        <div className="feature-setting-grid">
                                            {snapTo.map(([id, labelKey]) => (
                                                <SettingRow
                                                    key={id}
                                                    features={features}
                                                    onToggle={onToggle}
                                                    t={t}
                                                    id={id}
                                                    labelKey={labelKey}
                                                    hintKey=""
                                                />
                                            ))}
                                        </div>
                                        <h3 className="feature-subsection-title">{t('features.groupSnapFrom', 'Snap sources')}</h3>
                                        <div className="feature-setting-grid">
                                            {snapFrom.map(([id, labelKey]) => (
                                                <SettingRow
                                                    key={id}
                                                    features={features}
                                                    onToggle={onToggle}
                                                    t={t}
                                                    id={id}
                                                    labelKey={labelKey}
                                                    hintKey=""
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </section>

                            <section className="features-card">
                                <h3 className="features-card-title">{t('features.groupEditor', 'Editor')}</h3>
                                <SettingRow
                                    features={features}
                                    onToggle={onToggle}
                                    t={t}
                                    id="pasteNoOffset"
                                    labelKey="features.pasteNoOffset"
                                    hintKey="features.pasteNoOffsetHint"
                                />
                            </section>

                            <section className="features-card">
                                <h3 className="features-card-title">{t('features.groupNudge', 'Arrow-key movement')}</h3>
                                <SettingRow
                                    features={features}
                                    onToggle={onToggle}
                                    t={t}
                                    id="nudgeFixed"
                                    labelKey="features.nudgeFixed"
                                    hintKey="features.nudgeFixedHint"
                                />
                                {features.nudgeFixed ? (
                                    <div className="feature-number-grid">
                                        <NumberSettingRow
                                            features={features}
                                            onChangeValue={onChangeValue}
                                            t={t}
                                            id="nudgeNormal"
                                            labelKey="features.nudgeNormal"
                                            min={0.01}
                                            max={1000}
                                            step={0.1}
                                        />
                                        <NumberSettingRow
                                            features={features}
                                            onChangeValue={onChangeValue}
                                            t={t}
                                            id="nudgeShift"
                                            labelKey="features.nudgeShift"
                                            min={0.01}
                                            max={10000}
                                            step={0.1}
                                        />
                                    </div>
                                ) : null}
                            </section>

                            <section className="features-card">
                                <h3 className="features-card-title">{t('features.groupWorkspace', 'Workspace')}</h3>
                                <SettingRow
                                    features={features}
                                    onToggle={onToggle}
                                    t={t}
                                    id="infiniteCanvas"
                                    labelKey="features.infiniteCanvas"
                                    hintKey="features.infiniteCanvasHint"
                                />
                                <SettingRow
                                    features={features}
                                    onToggle={onToggle}
                                    t={t}
                                    id="repeatStage"
                                    labelKey="features.repeatStage"
                                    hintKey="features.repeatStageHint"
                                />
                                <SettingRow
                                    features={features}
                                    onToggle={onToggle}
                                    t={t}
                                    id="customStage"
                                    labelKey="features.customStage"
                                    hintKey="features.customStageHint"
                                />
                                {features.customStage ? (
                                    <div className="feature-number-grid">
                                        <NumberSettingRow
                                            features={features}
                                            onChangeValue={onChangeValue}
                                            t={t}
                                            id="stageWidth"
                                            labelKey="features.stageWidth"
                                            min={16}
                                            max={4096}
                                        />
                                        <NumberSettingRow
                                            features={features}
                                            onChangeValue={onChangeValue}
                                            t={t}
                                            id="stageHeight"
                                            labelKey="features.stageHeight"
                                            min={16}
                                            max={4096}
                                        />
                                    </div>
                                ) : null}
                            </section>

                            <section className="features-card">
                                <h3 className="features-card-title">{t('features.groupBackup', 'Backups')}</h3>
                                <SettingRow
                                    features={features}
                                    onToggle={onToggle}
                                    t={t}
                                    id="autoBackup"
                                    labelKey="features.autoBackup"
                                    hintKey="features.autoBackupHint"
                                />
                            </section>
                        </div>

                        <footer className="features-dialog-foot">
                            <button className="button button-primary" onClick={() => setOpen(false)} type="button">
                                {t('features.close', 'Close')}
                            </button>
                        </footer>
                    </div>
                </div>
            ) : null}
        </>
    );
};

export default FeaturesMenu;
