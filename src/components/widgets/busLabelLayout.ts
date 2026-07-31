export type BusLabelGeometry = {
  labelWidth: number;
  laneCount: number;
};

const MIN_LABEL_WIDTH = 48;
const MAX_LABEL_WIDTH = 84;
const SAME_LANE_GAP = 8;

export function getBusRouteHorizontalInset(labelWidth = MAX_LABEL_WIDTH): number {
  return Math.ceil(Math.max(0, labelWidth) / 2);
}

export function getBusLabelGeometry(rowWidth: number, nodeCount: number): BusLabelGeometry {
  const count = Math.max(0, Math.floor(nodeCount));
  if (count <= 1) {
    return { labelWidth: MAX_LABEL_WIDTH, laneCount: 1 };
  }

  const nodeSpacing = Math.max(0, rowWidth) / (count - 1);
  for (let laneCount = 1; laneCount < count; laneCount += 1) {
    const availableLabelWidth = nodeSpacing * laneCount - SAME_LANE_GAP;
    if (availableLabelWidth >= MIN_LABEL_WIDTH) {
      return {
        labelWidth: Math.min(MAX_LABEL_WIDTH, availableLabelWidth),
        laneCount,
      };
    }
  }

  // When even the minimum label width cannot repeat safely, give every node a
  // unique lane so there are no same-lane collisions.
  return { labelWidth: MIN_LABEL_WIDTH, laneCount: count };
}

export function getBusLabelLane(index: number, laneCount: number): number {
  return Math.max(0, index) % Math.max(1, Math.floor(laneCount));
}
