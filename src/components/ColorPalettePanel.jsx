import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {
    clamp,
    complementColor,
    hexToHsv,
    hsvToHex,
    mixColors
} from '../lib/palette.js';
import {addColorHistory, getColorHistory, normalizeHexColor} from '../lib/color-history.js';
import {CloseIcon} from './Icons.jsx';

const ColorPalettePanel = ({visible, onApplyColor, onClose}) => {
    const intl = useIntl();
    const t = (id, defaultMessage) => intl.formatMessage({id, defaultMessage});
    const [mixA, setMixA] = useState('#ff6b6b');
    const [mixB, setMixB] = useState('#4dabf7');
    const [ratio, setRatio] = useState(50);
    const [complementSource, setComplementSource] = useState('#855cd6');
    const [hsv, setHsv] = useState(() => ({...hexToHsv('#855cd6')}));
    const [history, setHistory] = useState(getColorHistory);
    const [copied, setCopied] = useState('');

    useEffect(() => {
        if (!visible) return;
        setHistory(getColorHistory());
    }, [visible]);

    const mixed = useMemo(() => mixColors(mixA, mixB, ratio), [mixA, mixB, ratio]);
    const complement = useMemo(() => complementColor(complementSource), [complementSource]);
    const hsvHex = useMemo(() => hsvToHex(hsv.h, hsv.s, hsv.v), [hsv]);

    const remember = color => {
        const normalized = normalizeHexColor(color);
        if (!normalized) return;
        setHistory(addColorHistory(normalized));
    };

    const copyColor = async color => {
        remember(color);
        try {
            await navigator.clipboard.writeText(color);
        } catch (error) {
            // Clipboard access may be unavailable in a non-secure context.
        }
        setCopied(color);
        window.setTimeout(() => setCopied(''), 1200);
    };

    const applyColor = (color, target) => {
        remember(color);
        if (onApplyColor) onApplyColor(color, target);
    };

    const setHsvValue = (key, value) => {
        const max = key === 'h' ? 360 : 100;
        setHsv(previous => ({...previous, [key]: clamp(Number(value) || 0, 0, max)}));
    };

    if (!visible) return null;

    const swatch = color => (
        <button
            aria-label={color}
            className="palette-swatch"
            key={color}
            onClick={() => copyColor(color)}
            style={{backgroundColor: color}}
            title={color}
            type="button"
        />
    );

    return (
        <aside className="color-palette-panel" aria-label={t('palette.title', 'Color palette')}>
            <header className="color-palette-head">
                <div>
                    <strong>{t('palette.title', 'Color palette')}</strong>
                    <small>{t('palette.hint', 'Mix, complement, convert and reuse colors')}</small>
                </div>
                <button aria-label={t('actions.close', 'Close')} className="icon-button" onClick={onClose} type="button">
                    <CloseIcon size={18}/>
                </button>
            </header>

            <div className="palette-grid">
                <section className="palette-card">
                    <h3>{t('palette.mix', 'Mix two colors')}</h3>
                    <div className="palette-inline">
                        <input aria-label="A" onChange={event => setMixA(event.target.value)} type="color" value={mixA}/>
                        <span className="palette-plus">+</span>
                        <input aria-label="B" onChange={event => setMixB(event.target.value)} type="color" value={mixB}/>
                        <input
                            aria-label={t('palette.ratio', 'Mix ratio')}
                            max="100"
                            min="0"
                            onChange={event => setRatio(Number(event.target.value))}
                            type="range"
                            value={ratio}
                        />
                        <span className="palette-value">{ratio}%</span>
                    </div>
                    <div className="palette-result-row">
                        <div className="palette-result" style={{backgroundColor: mixed}} title={mixed}/>
                        <code>{mixed}</code>
                        <button className="button button-small button-ghost" onClick={() => copyColor(mixed)} type="button">
                            {copied === mixed ? t('palette.copied', 'Copied') : t('palette.copy', 'Copy')}
                        </button>
                        <button className="button button-small button-ghost" onClick={() => applyColor(mixed, 'fill')} type="button">
                            {t('palette.fill', 'Fill')}
                        </button>
                        <button className="button button-small button-ghost" onClick={() => applyColor(mixed, 'stroke')} type="button">
                            {t('palette.stroke', 'Outline')}
                        </button>
                    </div>
                </section>

                <section className="palette-card">
                    <h3>{t('palette.complement', 'Complement')}</h3>
                    <div className="palette-inline">
                        <input
                            aria-label={t('palette.complement', 'Complement')}
                            onChange={event => setComplementSource(event.target.value)}
                            type="color"
                            value={complementSource}
                        />
                        <div className="palette-result" style={{backgroundColor: complement}}/>
                        <code>{complement}</code>
                    </div>
                    <div className="palette-actions">
                        <button className="button button-small button-ghost" onClick={() => copyColor(complement)} type="button">
                            {copied === complement ? t('palette.copied', 'Copied') : t('palette.copy', 'Copy')}
                        </button>
                        <button className="button button-small button-ghost" onClick={() => applyColor(complement, 'fill')} type="button">
                            {t('palette.fill', 'Fill')}
                        </button>
                        <button className="button button-small button-ghost" onClick={() => applyColor(complement, 'stroke')} type="button">
                            {t('palette.stroke', 'Outline')}
                        </button>
                    </div>
                </section>

                <section className="palette-card">
                    <h3>{t('palette.hsv', 'HSV → RGB')}</h3>
                    <div className="palette-inline">
                        {['h', 's', 'v'].map(key => (
                            <label className="palette-field" key={key}>
                                <span>{key.toUpperCase()}</span>
                                <input
                                    max={key === 'h' ? 360 : 100}
                                    min="0"
                                    onChange={event => setHsvValue(key, event.target.value)}
                                    type="number"
                                    value={Math.round(hsv[key])}
                                />
                            </label>
                        ))}
                    </div>
                    <div className="palette-result-row">
                        <div className="palette-result" style={{backgroundColor: hsvHex}}/>
                        <code>{hsvHex}</code>
                        <button className="button button-small button-ghost" onClick={() => copyColor(hsvHex)} type="button">
                            {copied === hsvHex ? t('palette.copied', 'Copied') : t('palette.copy', 'Copy')}
                        </button>
                        <button className="button button-small button-ghost" onClick={() => applyColor(hsvHex, 'fill')} type="button">
                            {t('palette.fill', 'Fill')}
                        </button>
                        <button className="button button-small button-ghost" onClick={() => applyColor(hsvHex, 'stroke')} type="button">
                            {t('palette.stroke', 'Outline')}
                        </button>
                    </div>
                </section>

            </div>

            <div className="palette-history">
                <span>{t('palette.recent', 'Recent colors')}</span>
                <div className="palette-swatches">
                    {history.length ? history.map(swatch) : (
                        <small>{t('palette.noHistory', 'Colors you use will appear here.')}</small>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default ColorPalettePanel;
