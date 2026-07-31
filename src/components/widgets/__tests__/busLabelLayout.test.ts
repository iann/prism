import {
  getBusLabelGeometry,
  getBusLabelLane,
  getBusRouteHorizontalInset,
} from '../busLabelLayout';

function expectCollisionFree(rowWidth: number, nodeCount: number) {
  const geometry = getBusLabelGeometry(rowWidth, nodeCount);
  const nodeSpacing = nodeCount <= 1 ? 0 : rowWidth / (nodeCount - 1);

  expect(geometry.labelWidth).toBeGreaterThanOrEqual(48);
  expect(geometry.labelWidth).toBeLessThanOrEqual(84);
  expect(geometry.laneCount).toBeGreaterThanOrEqual(1);
  expect(geometry.laneCount).toBeLessThanOrEqual(Math.max(1, nodeCount));

  for (let leftIndex = 0; leftIndex < nodeCount; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodeCount; rightIndex += 1) {
      const sameLane =
        getBusLabelLane(leftIndex, geometry.laneCount) ===
        getBusLabelLane(rightIndex, geometry.laneCount);
      if (sameLane) {
        const horizontalGap = (rightIndex - leftIndex) * nodeSpacing - geometry.labelWidth;
        expect(horizontalGap).toBeGreaterThanOrEqual(8 - Number.EPSILON);
      }
    }
  }

  return geometry;
}

describe('bus label layout', () => {
  it('uses one full-width lane when nodes have ample space', () => {
    expect(expectCollisionFree(320, 3)).toEqual({
      labelWidth: 84,
      laneCount: 1,
    });
  });

  it('adds lanes and narrows labels for dense rows', () => {
    const geometry = expectCollisionFree(120, 10);

    expect(geometry.laneCount).toBeGreaterThan(2);
    expect(geometry.labelWidth).toBeGreaterThanOrEqual(48);
  });

  it('uses unique lanes when a row is too narrow to repeat labels safely', () => {
    const geometry = expectCollisionFree(40, 10);

    expect(geometry).toEqual({
      labelWidth: 48,
      laneCount: 10,
    });
    expect(
      new Set(Array.from({ length: 10 }, (_, index) => getBusLabelLane(index, geometry.laneCount)))
        .size
    ).toBe(10);
  });

  it.each([
    [200, 5],
    [320, 3],
    [640, 5],
  ])(
    'contains the first and last labels within a %dpx route with %d nodes',
    (routeWidth, nodeCount) => {
      const inset = getBusRouteHorizontalInset();
      const rowWidth = routeWidth - inset * 2;
      const geometry = expectCollisionFree(rowWidth, nodeCount);
      const firstLabelLeft = inset - geometry.labelWidth / 2;
      const lastLabelRight = inset + rowWidth + geometry.labelWidth / 2;

      expect(firstLabelLeft).toBeGreaterThanOrEqual(0);
      expect(lastLabelRight).toBeLessThanOrEqual(routeWidth);
    }
  );
});
