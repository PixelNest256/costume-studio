import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import paper from '@scratch/paper';
import {EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, crosshairCursor, highlightSpecialChars} from '@codemirror/view';
import {EditorState, Compartment} from '@codemirror/state';
import {syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput, foldGutter, foldKeymap} from '@codemirror/language';
import {xml} from '@codemirror/lang-xml';
import {css} from '@codemirror/lang-css';
import {html} from '@codemirror/lang-html';
import {oneDark} from '@codemirror/theme-one-dark';
import {defaultKeymap, history, historyKeymap} from '@codemirror/commands';
import {autocompletion} from '@codemirror/autocomplete';
import {tags as t} from '@lezer/highlight';
import {closeBrackets, closeBracketsKeymap} from '@codemirror/autocomplete';

const svgTags = ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'use', 'image', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'symbol', 'switch', 'a'];
const svgAttrs = ['id', 'class', 'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'd', 'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points', 'viewBox', 'href', 'xlink:href', 'clip-path', 'mask', 'style', 'font-size', 'font-family', 'text-anchor'];

const svgSource = context => {
    const word = context.matchBefore(/[\w:-]+/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return {
        from: word.from,
        options: [
            {label: 'stroke-dasharray="4 2"', type: 'attribute', detail: 'dash pattern'},
            ...svgAttrs.map(attr => ({label: attr, type: 'attribute'})),
            ...svgTags.map(tag => ({label: tag, type: 'tag'}))
        ],
        validFor: /^[\w:-]*$/
    };
};

const svgCompletion = autocompletion({
    activateOnTyping: true,
    override: [svgSource]
});

const HighlightStyleSvg = HighlightStyle.define([
    {tag: t.tagName, color: '#7ee787'},
    {tag: t.attributeName, color: '#79c0ff'},
    {tag: t.attributeValue, color: '#a5d6ff'},
    {tag: t.number, color: '#79c0ff'},
    {tag: t.string, color: '#a5d6ff'},
    {tag: t.comment, color: '#8b949e', fontStyle: 'italic'}
]);

// Tint hex color tokens with their own color so they read as color codes
// at a glance. Clicking is not intercepted here; the native picker lives
// in the main color picker.
import {Decoration} from '@codemirror/view';
const hexMarkField = EditorView.decorations.of(view => {
    const ranges = [];
    const regex = /#[0-9a-fA-F]{3,8}\b/g;
    for (const {from, to} of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            const hex = match[0];
            const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
            ranges.push({
                from: from + match.index,
                to: from + match.index + hex.length,
                value: Decoration.mark({
                    class: 'cm-hex-token',
                    attributes: {style: `color: ${full}; font-weight: bold; text-decoration: underline dotted;`}
                })
            });
        }
    }
    return Decoration.set(ranges);
});

const SvgCodePanel = ({visible, onClose, t}) => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const selectedItems = useSelector(state => state.scratchPaint.selectedItems);
    const format = useSelector(state => state.scratchPaint.format);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const editorHostRef = useRef(null);
    const viewRef = useRef(null);
    const applyingRef = useRef(false);
    const codeRef = useRef('');
    codeRef.current = code;

    // Redux format values are keyMirror keys: 'VECTOR' / 'BITMAP'.
    const isVector = format === 'VECTOR' || format === 'VECTOR_SKIP_CONVERT';

    // Build CodeMirror once.
    useEffect(() => {
        if (!visible || !editorHostRef.current || viewRef.current) return;
        const state = EditorState.create({
            doc: codeRef.current,
            extensions: [
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightSpecialChars(),
                history(),
                foldGutter(),
                drawSelection(),
                rectangularSelection(),
                crosshairCursor(),
                highlightActiveLine(),
                bracketMatching(),
                indentOnInput(),
                closeBrackets(),
                xml(),
                css(),
                html(),
                svgCompletion,
                syntaxHighlighting(HighlightStyleSvg),
                oneDark,
                keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
                EditorView.lineWrapping,
                EditorView.updateListener.of(update => {
                    if (update.docChanged) {
                        setCode(update.state.doc.toString());
                    }
                }),
                hexMarkField
            ]
        });
        const view = new EditorView({state, parent: editorHostRef.current});
        viewRef.current = view;
        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // Sync CodeMirror content when selection changes or the panel becomes visible.
    // Selection may have happened before CodeMirror was mounted, so `visible`
    // must also trigger a sync after the editor view is created.
    useEffect(() => {
        const view = viewRef.current;
        if (!view || applyingRef.current) return;
        let next = '';
        try {
            if (selectedItems && selectedItems.length) {
                const items = selectedItems.filter(item => item && item.exportSVG);
                if (items.length === 1) {
                    const svgEl = items[0].exportSVG({bounds: 'content'});
                    next = new XMLSerializer().serializeToString(svgEl);
                } else if (items.length > 1) {
                    const group = new paper.Group(items.map(item => item.clone()));
                    const svgEl = group.exportSVG({bounds: 'content'});
                    next = new XMLSerializer().serializeToString(svgEl);
                    group.remove();
                }
            }
        } catch (e) {
            next = '';
        }
        if (next !== view.state.doc.toString()) {
            view.dispatch({
                changes: {from: 0, to: view.state.doc.length, insert: next}
            });
        }
        setCode(next);
    }, [selectedItems, visible]);

    const applyCode = useCallback(() => {
        if (!selectedItems || !selectedItems.length) return;
        applyingRef.current = true;
        try {
            const doc = new DOMParser().parseFromString(code, 'text/xml');
            if (doc.querySelector('parsererror')) {
                setError(t('code.invalid', 'Invalid SVG'));
                applyingRef.current = false;
                return;
            }
            setError('');
            const layer = paper.project.activeLayer;
            const oldItems = [...selectedItems];
            const imported = layer.importSVG(code, {expandShapes: true});
            if (!imported) {
                setError(t('code.importFailed', 'Could not import this SVG'));
                applyingRef.current = false;
                return;
            }
            // Place imported at the old selection position.
            if (oldItems.length) {
                let bounds = oldItems[0].bounds;
                for (const item of oldItems.slice(1)) bounds = bounds.unite(item.bounds);
                imported.position = bounds.center;
            }
            imported.selected = true;
            for (const item of oldItems) item.remove();
            dispatch({
                type: 'scratch-paint/select/CHANGE_SELECTED_ITEMS',
                selectedItems: paper.project.getSelectedItems(),
                bitmapMode: format === 'BITMAP' || format === 'BITMAP_SKIP_CONVERT'
            });
            // Trigger a save snapshot through the editor's update path is
            // handled by selection change; force a redraw.
            paper.view.update();
        } catch (e) {
            setError(t('code.importFailed', 'Could not import this SVG'));
        }
        applyingRef.current = false;
    }, [code, selectedItems, format, dispatch, t]);

    if (!visible) return null;

    return (
        <aside className="svg-code-panel" aria-label={t('code.title', 'SVG code')}>
            <div className="svg-code-head">
                <strong>{t('code.title', 'SVG code')}</strong>
                <div className="svg-code-head-actions">
                    <button className="button button-primary button-small" disabled={!isVector || !code} onClick={applyCode} type="button">
                        {t('code.apply', 'Apply')}
                    </button>
                    <button aria-label={t('actions.close', 'Close')} className="icon-button" onClick={onClose} type="button">
                        ✕
                    </button>
                </div>
            </div>
            {!isVector ? (
                <p className="svg-code-note">{t('code.vectorOnly', 'SVG code editing is available for vector costumes.')}</p>
            ) : selectedItems && selectedItems.length === 0 ? (
                <p className="svg-code-note">{t('code.noSelection', 'Select an object to edit its SVG code.')}</p>
            ) : null}
            {error ? <p className="svg-code-error">{error}</p> : null}
            <div className="svg-code-editor" ref={editorHostRef}/>
        </aside>
    );
};

export default SvgCodePanel;
