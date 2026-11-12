import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useIntl} from 'react-intl';

import {applyGradient, readGradient, restoreTargets, snapshotTargets} from '../../helper/advanced-gradient.js';
import styles from './gradient-editor.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const cssColor = stop => {
    const hex = String(stop.color || '#9966ff').replace('#', '');
    const value = hex.length === 3 ? hex.split('').map(part => part + part).join('') : hex;
    const match = /^([0-9a-f]{6})$/i.exec(value);
    if (!match) return `rgba(153,102,255,${stop.opacity})`;
    const number = parseInt(match[1], 16);
    return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${stop.opacity})`;
};

const mixStops = (a, b, offset) => {
    const parse = color => {
        const hex = String(color || '#000000').replace('#', '');
        const value = hex.length === 3 ? hex.split('').map(part => part + part).join('') : hex;
        const number = parseInt(value, 16);
        return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
    };
    const left = parse(a.color);
    const right = parse(b.color);
    const t = (offset - a.offset) / Math.max(1e-6, b.offset - a.offset);
    const channels = left.map((value, index) => Math.round(value + ((right[index] - value) * t)));
    return `#${channels.map(value => clamp(value, 0, 255).toString(16).padStart(2, '0')).join('')}`;
};

const messages = {
    title: {id: 'gradientEditor.title', defaultMessage: 'Advanced gradient'},
    linear: {id: 'gradientEditor.linear', defaultMessage: 'Linear'},
    radial: {id: 'gradientEditor.radial', defaultMessage: 'Radial'},
    angle: {id: 'gradientEditor.angle', defaultMessage: 'Angle'},
    centerX: {id: 'gradientEditor.centerX', defaultMessage: 'Center X'},
    centerY: {id: 'gradientEditor.centerY', defaultMessage: 'Center Y'},
    radius: {id: 'gradientEditor.radius', defaultMessage: 'Radius'},
    stops: {id: 'gradientEditor.stops', defaultMessage: 'Color stops'},
    position: {id: 'gradientEditor.position', defaultMessage: 'Position'},
    opacity: {id: 'gradientEditor.opacity', defaultMessage: 'Opacity'},
    addStop: {id: 'gradientEditor.addStop', defaultMessage: 'Add stop'},
    removeStop: {id: 'gradientEditor.removeStop', defaultMessage: 'Remove stop'},
    apply: {id: 'gradientEditor.apply', defaultMessage: 'Apply gradient'},
    cancel: {id: 'gradientEditor.cancel', defaultMessage: 'Cancel'},
    noSelection: {id: 'gradientEditor.noSelection', defaultMessage: 'Select an object to edit its gradient.'}
};

const AdvancedGradientEditor = ({isStroke, onClose, onUpdateImage}) => {
    const intl = useIntl();
    const t = (message, values) => intl.formatMessage(message, values);
    const [initial] = useState(() => readGradient(isStroke));
    const snapshotRef = useRef(initial ? snapshotTargets(initial.targets, isStroke) : []);
    const finishedRef = useRef(false);
    const dragRef = useRef(null);
    const nextIdRef = useRef(1);
    const trackRef = useRef(null);
    const [type, setType] = useState(initial ? initial.type : 'linear');
    const [angle, setAngle] = useState(initial ? initial.angle : 0);
    const [centerX, setCenterX] = useState(initial ? initial.centerX : 50);
    const [centerY, setCenterY] = useState(initial ? initial.centerY : 50);
    const [radius, setRadius] = useState(initial ? initial.radius : 100);
    const [stops, setStops] = useState(initial ? initial.stops : []);
    const [selectedStopId, setSelectedStopId] = useState(initial && initial.stops[0] ? initial.stops[0].id : null);

    const targets = initial ? initial.targets : [];
    const sortedStops = stops.slice().sort((a, b) => a.offset - b.offset);
    const preview = sortedStops.length ?
        `linear-gradient(90deg, ${sortedStops.map(stop =>
            `${cssColor(stop)} ${clamp(stop.offset, 0, 1) * 100}%`).join(', ')})` :
        '#9966ff';

    useEffect(() => {
        if (!initial || finishedRef.current) return;
        applyGradient({
            targets,
            type,
            angle,
            centerX,
            centerY,
            radius,
            stops
        }, isStroke);
    }, [angle, centerX, centerY, initial, isStroke, radius, stops, targets, type]);

    useEffect(() => () => {
        if (!finishedRef.current) {
            restoreTargets(snapshotRef.current, isStroke);
        }
    }, [isStroke]);

    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === 'Escape') cancel();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    });

    const cancel = () => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        restoreTargets(snapshotRef.current, isStroke);
        onClose();
    };

    const commit = () => {
        if (!initial) return;
        finishedRef.current = true;
        applyGradient({
            targets,
            type,
            angle,
            centerX,
            centerY,
            radius,
            stops
        }, isStroke);
        onUpdateImage();
        onClose();
    };

    const updateStop = (id, patch) => {
        setStops(current => current.map(stop => stop.id === id ? {...stop, ...patch} : stop));
    };

    const addStop = offset => {
        if (sortedStops.length < 2) return;
        const bounded = clamp(offset, 0, 1);
        const next = sortedStops.find(stop => stop.offset > bounded) || sortedStops[sortedStops.length - 1];
        const previous = sortedStops.filter(stop => stop.offset < bounded).pop() || sortedStops[0];
        const left = previous.offset <= bounded ? previous : next;
        const right = next.offset >= bounded ? next : previous;
        const color = left === right ? left.color : mixStops(left, right, bounded);
        const opacity = left.opacity + ((right.opacity - left.opacity) *
            ((bounded - left.offset) / Math.max(1e-6, right.offset - left.offset)));
        const id = `stop-new-${nextIdRef.current++}`;
        setStops(current => [...current, {id, offset: bounded, color, opacity}]);
        setSelectedStopId(id);
    };

    const removeStop = id => {
        if (stops.length <= 2) return;
        setStops(current => current.filter(stop => stop.id !== id));
        if (selectedStopId === id) setSelectedStopId(null);
    };

    const beginDrag = (event, stop) => {
        event.stopPropagation();
        event.preventDefault();
        const track = trackRef.current;
        if (!track) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {id: stop.id, rect: track.getBoundingClientRect()};
        setSelectedStopId(stop.id);
    };

    const dragStop = event => {
        const drag = dragRef.current;
        if (!drag) return;
        const offset = clamp((event.clientX - drag.rect.left) / drag.rect.width, 0, 1);
        updateStop(drag.id, {offset});
    };

    const endDrag = event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
    };

    const handleTrackClick = event => {
        const track = trackRef.current;
        if (!track || !stops.length) return;
        const rect = track.getBoundingClientRect();
        addStop((event.clientX - rect.left) / rect.width);
    };

    return createPortal(
        <div
            className={styles.backdrop}
            onMouseDown={event => {
                if (event.target === event.currentTarget) cancel();
            }}
        >
            <div aria-modal="true" className={styles.dialog} role="dialog">
                <div className={styles.header}>
                    <h2>{t(messages.title)}</h2>
                    <button className={styles.close} onClick={cancel} type="button">×</button>
                </div>
                {!initial ? (
                    <p className={styles.empty}>{t(messages.noSelection)}</p>
                ) : (
                    <>
                        <div className={styles.typeRow}>
                            <button
                                className={type === 'linear' ? styles.typeSelected : styles.type}
                                onClick={() => setType('linear')}
                                type="button"
                            >
                                {t(messages.linear)}
                            </button>
                            <button
                                className={type === 'radial' ? styles.typeSelected : styles.type}
                                onClick={() => setType('radial')}
                                type="button"
                            >
                                {t(messages.radial)}
                            </button>
                        </div>
                        <div
                            className={styles.track}
                            onClick={handleTrackClick}
                            ref={trackRef}
                            style={{background: preview}}
                        >
                            {stops.map(stop => (
                                <button
                                    aria-label={t(messages.removeStop)}
                                    className={styles.stopHandle}
                                    key={stop.id}
                                    onClick={event => event.stopPropagation()}
                                    onPointerDown={event => beginDrag(event, stop)}
                                    onPointerMove={dragStop}
                                    onPointerUp={endDrag}
                                    style={{left: `${clamp(stop.offset, 0, 1) * 100}%`}}
                                    title={t(messages.removeStop)}
                                    type="button"
                                >
                                    <span style={{background: stop.color}}/>
                                </button>
                            ))}
                        </div>
                        <div className={styles.stopActions}>
                            <span>{t(messages.stops)}</span>
                            <button onClick={() => addStop(0.5)} type="button">+ {t(messages.addStop)}</button>
                        </div>
                        <div className={styles.stopList}>
                            {stops.map(stop => (
                                <div
                                    className={selectedStopId === stop.id ? styles.stopRowSelected : styles.stopRow}
                                    key={stop.id}
                                    onClick={() => setSelectedStopId(stop.id)}
                                >
                                    <input
                                        aria-label={t(messages.stops)}
                                        onChange={event => updateStop(stop.id, {color: event.target.value})}
                                        type="color"
                                        value={stop.color}
                                    />
                                    <label>
                                        {t(messages.position)}
                                        <input
                                            max="100"
                                            min="0"
                                            onChange={event => updateStop(stop.id, {
                                                offset: clamp(Number(event.target.value) / 100, 0, 1)
                                            })}
                                            step="1"
                                            type="number"
                                            value={Math.round(stop.offset * 100)}
                                        />
                                    </label>
                                    <label>
                                        {t(messages.opacity)}
                                        <input
                                            max="1"
                                            min="0"
                                            onChange={event => updateStop(stop.id, {opacity: Number(event.target.value)})}
                                            step="0.05"
                                            type="number"
                                            value={stop.opacity}
                                        />
                                    </label>
                                    <button
                                        disabled={stops.length <= 2}
                                        onClick={event => {
                                            event.stopPropagation();
                                            removeStop(stop.id);
                                        }}
                                        title={t(messages.removeStop)}
                                        type="button"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                        {type === 'linear' ? (
                            <label className={styles.control}>
                                {t(messages.angle)}
                                <input
                                    max="360"
                                    min="-360"
                                    onChange={event => setAngle(Number(event.target.value))}
                                    step="1"
                                    type="range"
                                    value={angle}
                                />
                                <input
                                    onChange={event => setAngle(Number(event.target.value))}
                                    step="1"
                                    type="number"
                                    value={angle}
                                />
                                <span>°</span>
                            </label>
                        ) : (
                            <div className={styles.radialControls}>
                                <label>
                                    {t(messages.centerX)}
                                    <input
                                        max="200"
                                        min="-100"
                                        onChange={event => setCenterX(Number(event.target.value))}
                                        step="1"
                                        type="number"
                                        value={centerX}
                                    />
                                </label>
                                <label>
                                    {t(messages.centerY)}
                                    <input
                                        max="200"
                                        min="-100"
                                        onChange={event => setCenterY(Number(event.target.value))}
                                        step="1"
                                        type="number"
                                        value={centerY}
                                    />
                                </label>
                                <label>
                                    {t(messages.radius)}
                                    <input
                                        max="300"
                                        min="1"
                                        onChange={event => setRadius(Number(event.target.value))}
                                        step="1"
                                        type="number"
                                        value={radius}
                                    />
                                </label>
                            </div>
                        )}
                        <div className={styles.footer}>
                            <button onClick={cancel} type="button">{t(messages.cancel)}</button>
                            <button className={styles.apply} onClick={commit} type="button">
                                {t(messages.apply)}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

export default AdvancedGradientEditor;
