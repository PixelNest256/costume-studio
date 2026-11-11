import paper from '@scratch/paper';

// Path text is an explicit conversion: the selected PointText becomes one
// PointText per character so each glyph can follow the tangent of a path.
// The original text is replaced only when the drag actually finds a target.
//
// Paper.js quirk that matters here: `item.position` is the center of the
// item's bounds (not the text anchor), and setting `item.rotation` rotates
// around that center. So a glyph must be rotated first and only then moved
// onto the path, otherwise the rotation drags the glyph off the path again.
const isVisibleLine = item => Boolean(
    item &&
    item.strokeColor &&
    item.strokeColor.alpha !== 0 &&
    Number(item.strokeWidth) > 0
);

const collectLinePaths = (item, selectedItems, paths) => {
    if (!item || item.guide || item.locked || (item.data && item.data.isHelperItem)) return;
    if (selectedItems.includes(item)) return;
    if (item instanceof paper.PointText) return;
    if (item.data && item.data.isPathTextChar) return;

    if (item instanceof paper.Path || item instanceof paper.CompoundPath) {
        if (isVisibleLine(item)) paths.push(item);
        return;
    }
    if (item.children) {
        for (const child of item.children) collectLinePaths(child, selectedItems, paths);
    }
};

/**
 * Find the closest stroked path under/near a project point.
 * @param {paper.Point} point Point in project coordinates
 * @param {Array<paper.Item>} selectedItems Currently selected items to ignore
 * @param {number} threshold Maximum distance in project units
 * @returns {?{path: paper.PathItem, offset: number, point: paper.Point, distance: number}}
 */
export const findPathTextTarget = (point, selectedItems, threshold) => {
    const layer = paper.project.getItem({data: {isPaintingLayer: true}});
    if (!layer || !layer.children) return null;
    const paths = [];
    for (const child of layer.children) collectLinePaths(child, selectedItems, paths);

    let best = null;
    for (const path of paths) {
        if (!path.getNearestLocation) continue;
        const location = path.getNearestLocation(point);
        if (!location) continue;
        const pathPoint = location.getPoint();
        const distance = pathPoint.getDistance(point);
        if (distance <= threshold && (!best || distance < best.distance)) {
            best = {
                path,
                offset: location.getOffset(),
                point: pathPoint,
                distance
            };
        }
    }
    return best;
};

const pathLength = path => {
    const length = path.getLength ? path.getLength() : path.length;
    return Number(length) || 0;
};

const glyphText = value => {
    // A path is one continuous baseline; line breaks become spaces.
    return String(value || '').replace(/\r\n|\r|\n/g, ' ');
};

/**
 * Measure a single character as a standalone PointText anchored at the origin.
 * The advance is the measured text width (the same metric the browser uses to
 * lay out a normal line of text), which stays proportional to each character's
 * own width. The stroke-padded ink box is deliberately not used: it inflates
 * narrow characters and especially spaces, which makes word gaps look wrong.
 * @param {string} character Single character
 * @param {paper.PointText} textItem Source text (for font and style)
 * @param {number} fontSize Glyph font size in project units
 * @returns {paper.PointText} Glyph with `data.advance`
 */
const createGlyph = (character, textItem, fontSize) => {
    const glyph = new paper.PointText({
        content: character,
        font: textItem.font,
        fontSize,
        justification: 'left',
        point: new paper.Point(0, 0)
    });
    glyph.setStyle(textItem.getStyle());
    glyph.fontSize = fontSize;
    glyph.justification = 'left';

    const advance = Math.max(0.1, Number(glyph.bounds.width) || 0);
    glyph.data = {
        isPathTextChar: true,
        advance
    };
    return glyph;
};

/**
 * Turn a PointText into a group of per-character PointText items.
 * @param {paper.PointText} textItem Source text
 * @returns {?paper.Group} New group, inserted at the source position
 */
export const createPathText = textItem => {
    if (!(textItem instanceof paper.PointText)) return null;
    const content = glyphText(textItem.content);
    if (!content.length) return null;

    const matrix = textItem.matrix;
    const scaling = matrix && matrix.getScaling ? matrix.getScaling() : new paper.Point(1, 1);
    const fontScale = Math.max(0.01, (Math.abs(scaling.x) + Math.abs(scaling.y)) / 2);
    const fontSize = Math.max(1, textItem.fontSize * fontScale);
    const group = new paper.Group();

    for (const character of Array.from(content)) {
        group.addChild(createGlyph(character, textItem, fontSize));
    }

    group.data = {
        isPathText: true,
        pathTextSource: textItem.content
    };

    const parent = textItem.parent;
    const index = textItem.index;
    if (parent) {
        parent.insertChild(index, group);
    }
    textItem.remove();
    return group;
};

/**
 * Lay a path-text group along a path, beginning at an offset.
 * Every glyph is rotated to the path's tangent and then translated so its
 * baseline anchor sits exactly on the path, so glyph bottoms follow the curve.
 * @param {paper.Group} group Path-text group
 * @param {paper.PathItem} path Target path
 * @param {number} startOffset Offset from the beginning of the path
 * @returns {boolean} True if the group was laid out
 */
export const layoutPathText = (group, path, startOffset) => {
    if (!group || !path || !group.children || !group.children.length) return false;
    const length = pathLength(path);
    if (!length || !path.getLocationAt) return false;

    const closed = Boolean(path.closed);
    const advanceOf = glyph => {
        const advance = glyph.data && Number(glyph.data.advance);
        return advance > 0 ? advance : Math.max(1, Number(glyph.bounds.width) || 1);
    };
    let advances = group.children.map(advanceOf);
    let totalAdvance = advances.reduce((sum, advance) => sum + advance, 0);
    const seamGap = closed ? Math.min(10, length * 0.02) : 0;
    const available = closed ? Math.max(1, length - seamGap) :
        Math.max(1, length - Math.max(0, startOffset));

    // If the text is longer than the path, scale the glyphs themselves as well
    // as their advances, so the characters keep their proportions instead of
    // piling up at the seam.
    if (!group.data.pathTextFitScale && totalAdvance > available) {
        const fitScale = available / totalAdvance;
        for (const glyph of group.children) {
            glyph.fontSize *= fitScale;
            if (glyph.data) glyph.data.advance *= fitScale;
        }
        group.data.pathTextFitScale = fitScale;
        advances = group.children.map(advanceOf);
        totalAdvance = advances.reduce((sum, advance) => sum + advance, 0);
    }

    let offset = Number(startOffset) || 0;
    for (let index = 0; index < group.children.length; index++) {
        const glyph = group.children[index];
        const normalized = closed ?
            ((offset % length) + length) % length :
            Math.max(0, Math.min(offset, length));
        const location = path.getLocationAt(normalized);
        if (location) {
            const point = location.getPoint();
            const tangent = location.getTangent();
            if (tangent && (tangent.x || tangent.y)) {
                // Rotate first (Paper.js rotates around the glyph's bounds
                // center), then move the glyph's anchor onto the path point.
                glyph.rotation = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
            }
            glyph.point = point;
        }
        offset += advances[index];
    }
    return true;
};
