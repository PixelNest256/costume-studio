import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import paper from '@scratch/paper';
import {useDispatch, useSelector} from 'react-redux';
import {defineMessages, useIntl} from 'react-intl';

import {getSelectedLeafItems, getSelectedRootItems} from '../../helper/selection';
import {setSelectedItems} from '../../reducers/selected-items';
import styles from './precise-transform-panel.css';

const messages = defineMessages({
    title: {id: 'transform.title', defaultMessage: 'Precise transform'},
    selectionCount: {id: 'transform.selectionCount', defaultMessage: '{count} selected'},
    selectPrompt: {id: 'transform.selectPrompt', defaultMessage: 'Select one or more objects to edit.'},
    collapse: {id: 'transform.collapse', defaultMessage: 'Collapse panel'},
    expand: {id: 'transform.expand', defaultMessage: 'Expand panel'},
    moveTitle: {id: 'transform.moveTitle', defaultMessage: 'Move amount (px)'},
    scaleTitle: {id: 'transform.scaleTitle', defaultMessage: 'Scale (%)'},
    rotateTitle: {id: 'transform.rotateTitle', defaultMessage: 'Rotation (°)'},
    rotateHint: {id: 'transform.rotateHint', defaultMessage: 'Positive angles rotate clockwise.'},
    x: {id: 'transform.x', defaultMessage: 'X'},
    y: {id: 'transform.y', defaultMessage: 'Y'},
    degrees: {id: 'transform.degrees', defaultMessage: '°'},
    applyMove: {id: 'transform.applyMove', defaultMessage: 'Move'},
    applyScale: {id: 'transform.applyScale', defaultMessage: 'Scale'},
    applyRotate: {id: 'transform.applyRotate', defaultMessage: 'Rotate'},
    keepRatio: {id: 'transform.keepRatio', defaultMessage: 'Lock aspect ratio'},
    pivot: {id: 'transform.pivot', defaultMessage: 'Transform center'},
    moveHint: {id: 'transform.moveHint', defaultMessage: 'Positive X is right; positive Y is up.'},
    scaleHint: {id: 'transform.scaleHint', defaultMessage: '100% keeps the current size; negative values flip.'},
    invalidNumber: {id: 'transform.invalidNumber', defaultMessage: 'Enter valid numeric values.'},
    zeroScale: {id: 'transform.zeroScale', defaultMessage: 'Scale must not be zero.'},
    pivotTopLeft: {id: 'transform.pivotTopLeft', defaultMessage: 'Top left'},
    pivotTop: {id: 'transform.pivotTop', defaultMessage: 'Top center'},
    pivotTopRight: {id: 'transform.pivotTopRight', defaultMessage: 'Top right'},
    pivotLeft: {id: 'transform.pivotLeft', defaultMessage: 'Middle left'},
    pivotCenter: {id: 'transform.pivotCenter', defaultMessage: 'Center'},
    pivotRight: {id: 'transform.pivotRight', defaultMessage: 'Middle right'},
    pivotBottomLeft: {id: 'transform.pivotBottomLeft', defaultMessage: 'Bottom left'},
    pivotBottom: {id: 'transform.pivotBottom', defaultMessage: 'Bottom center'},
    pivotBottomRight: {id: 'transform.pivotBottomRight', defaultMessage: 'Bottom right'}
});

const pivotOptions = [
    {id: 'topLeft', x: 0, y: 0, message: messages.pivotTopLeft},
    {id: 'top', x: 0.5, y: 0, message: messages.pivotTop},
    {id: 'topRight', x: 1, y: 0, message: messages.pivotTopRight},
    {id: 'left', x: 0, y: 0.5, message: messages.pivotLeft},
    {id: 'center', x: 0.5, y: 0.5, message: messages.pivotCenter},
    {id: 'right', x: 1, y: 0.5, message: messages.pivotRight},
    {id: 'bottomLeft', x: 0, y: 1, message: messages.pivotBottomLeft},
    {id: 'bottom', x: 0.5, y: 1, message: messages.pivotBottom},
    {id: 'bottomRight', x: 1, y: 1, message: messages.pivotBottomRight}
];

const readNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const getSelectionBounds = items => items.reduce(
    (bounds, item) => bounds ? bounds.unite(item.bounds) : item.bounds.clone(),
    null
);

const NumericField = ({label, value, onChange, step = '1'}) => (
    <label className={styles.field}>
        <span>{label}</span>
        <input type="number" step={step} value={value} onChange={event => onChange(event.target.value)}/>
    </label>
);

NumericField.propTypes = {
    label: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    step: PropTypes.string,
    value: PropTypes.string.isRequired
};

const PreciseTransformPanel = ({onUpdateImage}) => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const selectionState = useSelector(state => state.scratchPaint.selectedItems);
    const [moveX, setMoveX] = useState('0');
    const [moveY, setMoveY] = useState('0');
    const [scaleX, setScaleX] = useState('100');
    const [scaleY, setScaleY] = useState('100');
    const [rotation, setRotation] = useState('0');
    const [lockRatio, setLockRatio] = useState(true);
    const [pivot, setPivot] = useState('center');
    const [collapsed, setCollapsed] = useState(false);
    const [error, setError] = useState('');
    const items = getSelectedRootItems();
    const bounds = items.length ? getSelectionBounds(items) : null;

    useEffect(() => {
        setMoveX('0');
        setMoveY('0');
        setScaleX('100');
        setScaleY('100');
        setRotation('0');
        setLockRatio(true);
        setPivot('center');
        setError('');
    }, [selectionState]);

    const getPivotPoint = selectionBounds => {
        const anchor = pivotOptions.find(option => option.id === pivot) || pivotOptions[4];
        return new paper.Point(
            selectionBounds.left + (selectionBounds.width * anchor.x),
            selectionBounds.top + (selectionBounds.height * anchor.y)
        );
    };

    const commitTransform = transform => {
        const selectedItems = getSelectedRootItems();
        if (!selectedItems.length) return;
        const selectedBounds = getSelectionBounds(selectedItems);
        const center = getPivotPoint(selectedBounds);
        transform(selectedItems, center);
        dispatch(setSelectedItems(getSelectedLeafItems(), false));
        paper.view.update();
        onUpdateImage();
        setError('');
    };

    const applyMove = () => {
        const dx = readNumber(moveX);
        const dy = readNumber(moveY);
        if (dx === null || dy === null) {
            setError(intl.formatMessage(messages.invalidNumber));
            return;
        }
        if (dx === 0 && dy === 0) return;
        commitTransform(selectedItems => {
            const delta = new paper.Point(dx, -dy);
            selectedItems.forEach(item => item.translate(delta));
        });
    };

    const applyScale = () => {
        const horizontal = readNumber(scaleX);
        const vertical = readNumber(scaleY);
        if (horizontal === null || vertical === null) {
            setError(intl.formatMessage(messages.invalidNumber));
            return;
        }
        if (horizontal === 0 || vertical === 0) {
            setError(intl.formatMessage(messages.zeroScale));
            return;
        }
        if (horizontal === 100 && vertical === 100) return;
        commitTransform((selectedItems, center) => {
            selectedItems.forEach(item => item.scale(horizontal / 100, vertical / 100, center));
        });
    };

    const applyRotation = () => {
        const angle = readNumber(rotation);
        if (angle === null) {
            setError(intl.formatMessage(messages.invalidNumber));
            return;
        }
        if (angle === 0) return;
        commitTransform((selectedItems, center) => {
            selectedItems.forEach(item => item.rotate(angle, center));
        });
    };

    return (
        <section aria-label={intl.formatMessage(messages.title)} className={styles.panel}>
            <header className={styles.header}>
                <div className={styles.heading}>
                    <strong>{intl.formatMessage(messages.title)}</strong>
                    <small>{intl.formatMessage(messages.selectionCount, {count: items.length})}</small>
                </div>
                <button
                    aria-expanded={!collapsed}
                    aria-label={intl.formatMessage(collapsed ? messages.expand : messages.collapse)}
                    className={styles.collapseButton}
                    onClick={() => setCollapsed(value => !value)}
                    type="button"
                >
                    {collapsed ? '＋' : '−'}
                </button>
            </header>
            {!collapsed ? (
                <div className={styles.body}>
                    {!bounds ? <p className={styles.empty}>{intl.formatMessage(messages.selectPrompt)}</p> : (
                        <>
                            <fieldset className={styles.section} disabled={!items.length}>
                                <legend>{intl.formatMessage(messages.moveTitle)}</legend>
                                <div className={styles.fieldRow}>
                                    <NumericField label={intl.formatMessage(messages.x)} value={moveX} onChange={setMoveX} step="0.1"/>
                                    <NumericField label={intl.formatMessage(messages.y)} value={moveY} onChange={setMoveY} step="0.1"/>
                                    <button className={styles.applyButton} onClick={applyMove} type="button">
                                        {intl.formatMessage(messages.applyMove)}
                                    </button>
                                </div>
                                <p className={styles.hint}>{intl.formatMessage(messages.moveHint)}</p>
                            </fieldset>
                            <fieldset className={styles.section} disabled={!items.length}>
                                <legend>{intl.formatMessage(messages.scaleTitle)}</legend>
                                <div className={styles.fieldRow}>
                                    <NumericField
                                        label={intl.formatMessage(messages.x)}
                                        value={scaleX}
                                        onChange={value => {
                                            setScaleX(value);
                                            if (lockRatio) setScaleY(value);
                                        }}
                                        step="0.1"
                                    />
                                    <NumericField
                                        label={intl.formatMessage(messages.y)}
                                        value={scaleY}
                                        onChange={value => {
                                            setScaleY(value);
                                            if (lockRatio) setScaleX(value);
                                        }}
                                        step="0.1"
                                    />
                                </div>
                                <label className={styles.ratioToggle}>
                                    <input checked={lockRatio} onChange={event => setLockRatio(event.target.checked)} type="checkbox"/>
                                    <span>{intl.formatMessage(messages.keepRatio)}</span>
                                </label>
                                <p className={styles.hint}>{intl.formatMessage(messages.scaleHint)}</p>
                                <div className={styles.pivotSection}>
                                    <span>{intl.formatMessage(messages.pivot)}</span>
                                    <div aria-label={intl.formatMessage(messages.pivot)} className={styles.pivotGrid} role="group">
                                        {pivotOptions.map(option => (
                                            <button
                                                aria-label={intl.formatMessage(option.message)}
                                                aria-pressed={pivot === option.id}
                                                className={`${styles.pivotButton}${pivot === option.id ? ` ${styles.isPivotSelected}` : ''}`}
                                                key={option.id}
                                                onClick={() => setPivot(option.id)}
                                                title={intl.formatMessage(option.message)}
                                                type="button"
                                            >
                                                <span className={styles.pivotDot}/>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button className={styles.applyButton} onClick={applyScale} type="button">
                                    {intl.formatMessage(messages.applyScale)}
                                </button>
                            </fieldset>
                            <fieldset className={styles.section} disabled={!items.length}>
                                <legend>{intl.formatMessage(messages.rotateTitle)}</legend>
                                <div className={styles.fieldRow}>
                                    <NumericField label={intl.formatMessage(messages.degrees)} value={rotation} onChange={setRotation} step="0.1"/>
                                    <button className={styles.applyButton} onClick={applyRotation} type="button">
                                        {intl.formatMessage(messages.applyRotate)}
                                    </button>
                                </div>
                                <p className={styles.hint}>{intl.formatMessage(messages.rotateHint)}</p>
                            </fieldset>
                            {error ? <p className={styles.error} role="alert">{error}</p> : null}
                        </>
                    )}
                </div>
            ) : null}
        </section>
    );
};

PreciseTransformPanel.propTypes = {
    onUpdateImage: PropTypes.func.isRequired
};

export default PreciseTransformPanel;
