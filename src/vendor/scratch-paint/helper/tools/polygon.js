import paper from '@scratch/paper';

const EPSILON = 1e-6;

/**
 * Build the sharp vertices of a regular/star polygon centered at (0, 0).
 * @param {number} sideCount Number of outer points.
 * @param {number} pointCount Inner/outer radius ratio. 1 makes a regular polygon.
 * @param {number} radius Circumradius.
 * @returns {Array<paper.Point>}
 */
export const getPolygonPoints = (sideCount, pointCount, radius = 50) => {
    const points = [];
    const count = Math.max(3, Math.floor(Number(sideCount) || 3));
    const ratio = Math.max(0.01, Number(pointCount) || 1);
    // Four-sided polygons should line up like the old rectangle tool instead
    // of appearing as a diamond. Multiples of four get flat top/bottom edges.
    const rotationOffset = count % 4 === 0 ? Math.PI / count : 0;
    for (let i = 0; i < count; i++) {
        const angle = ((i / count) * Math.PI * 2) + rotationOffset;
        const innerAngle = angle + (Math.PI / count);
        points.push(new paper.Point(Math.sin(angle) * radius, -Math.cos(angle) * radius));
        if (ratio !== 1) {
            points.push(new paper.Point(
                Math.sin(innerAngle) * radius * ratio,
                -Math.cos(innerAngle) * radius * ratio
            ));
        }
    }
    return points;
};

const handleLength = (radius, angle) => (
    radius * (4 / 3) * Math.tan(((Math.PI - angle) / 2) / 2)
);

/**
 * Create a closed path from points, optionally replacing each corner with a
 * circular-arc approximation made of two Bezier segments.
 * @param {Array<paper.Point>} points Corner points in project space.
 * @param {number} roundedCornerSize Corner radius in project units.
 * @returns {paper.Path}
 */
export const createPolygonPath = (points, roundedCornerSize) => {
    const radius = Math.max(0, Number(roundedCornerSize) || 0);
    const count = points.length;
    if (radius <= 0) {
        return new paper.Path({
            segments: points.map(point => new paper.Segment(point.clone())),
            closed: true
        });
    }

    const segments = [];
    for (let i = 0; i < count; i++) {
        const previous = points[(i - 1 + count) % count];
        const corner = points[i];
        const next = points[(i + 1) % count];
        const previousVector = previous.subtract(corner);
        const nextVector = next.subtract(corner);
        if (previousVector.length < EPSILON || nextVector.length < EPSILON) {
            segments.push(new paper.Segment(corner.clone()));
            continue;
        }

        const previousUnit = previousVector.normalize();
        const nextUnit = nextVector.normalize();
        const dot = Math.max(-1, Math.min(1, previousUnit.dot(nextUnit)));
        if (dot > 0.98 || dot < -0.98) {
            segments.push(new paper.Segment(corner.clone()));
            continue;
        }

        const angle = Math.acos(dot);
        const tanHalfAngle = Math.tan(angle / 2);
        const maxRadius = Math.min(previousVector.length, nextVector.length) * tanHalfAngle;
        const cornerRadius = Math.min(radius, maxRadius);
        if (cornerRadius < 0.1) {
            segments.push(new paper.Segment(corner.clone()));
            continue;
        }

        const tangentDistance = cornerRadius / tanHalfAngle;
        const length = handleLength(cornerRadius, angle);
        const p1 = corner.add(previousUnit.multiply(tangentDistance));
        const p2 = corner.add(nextUnit.multiply(tangentDistance));
        segments.push(new paper.Segment(
            p1,
            new paper.Point(0, 0),
            previousUnit.multiply(-length)
        ));
        segments.push(new paper.Segment(
            p2,
            nextUnit.multiply(-length),
            new paper.Point(0, 0)
        ));
    }

    return new paper.Path({segments, closed: true});
};

/**
 * Create a polygon fitted to a rectangle. The corner radius is applied in
 * project units after fitting, so it is not stretched by the rectangle.
 */
export const createPolygonInBounds = (bounds, sideCount, pointCount, roundedCornerSize) => {
    const sharp = new paper.Path({
        segments: getPolygonPoints(sideCount, pointCount),
        closed: true
    });
    sharp.bounds = bounds;
    const points = sharp.segments.map(segment => segment.point.clone());
    sharp.remove();
    return createPolygonPath(points, roundedCornerSize);
};
