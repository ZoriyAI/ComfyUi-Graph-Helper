import { describe, expect, it } from 'vitest';
import { holdsBothPanels, panelToFold } from '../../src/renderer/state/frame';
import { CANVAS_MIN, SPLIT_MIN, TAB_MIN } from '../../src/renderer/state/dockState';
import { RAIL_WIDTH } from '../../src/renderer/state/uiState';
import { BUILD_BUBBLE_PX, BUILD_ROOM_PX, cameraCenter, TOOLBAR_ROOM_PX } from '../../src/renderer/components/graph/lib/followCamera';

/**
 * In a narrow window the library and the right panel together left the canvas a strip, and what floats over the
 * canvas stuck out of it. And the camera that follows a build put the step's bubble under the build strip for any
 * tall node. Both are arithmetic, checked here; the walk in tests/e2e/layout-walk.test.ts looks at the result.
 */
describe('the window frame keeps the canvas usable', () => {
  const both = { railOpen: true, dockCollapsed: false, split: false };

  it('holds both panels only while the canvas keeps its minimum', () => {
    const edge = RAIL_WIDTH + TAB_MIN + CANVAS_MIN;
    expect(holdsBothPanels(edge, false)).toBe(true);
    expect(holdsBothPanels(edge - 1, false)).toBe(false);
    expect(holdsBothPanels(RAIL_WIDTH + SPLIT_MIN + CANVAS_MIN - 1, true)).toBe(false);
    expect(holdsBothPanels(1920, true)).toBe(true);
  });

  it('folds the panel the person did not just open', () => {
    expect(panelToFold(1024, both, 'rail')).toBe('dock');
    expect(panelToFold(1024, both, 'dock')).toBe('rail');
    // The window shrank: the library goes, the conversation stays.
    expect(panelToFold(800, both, 'window')).toBe('rail');
  });

  it('leaves a wide window and a single open panel alone', () => {
    expect(panelToFold(1440, both, 'rail')).toBeNull();
    expect(panelToFold(800, { ...both, railOpen: false }, 'dock')).toBeNull();
    expect(panelToFold(800, { ...both, dockCollapsed: true }, 'rail')).toBeNull();
  });
});

describe('the camera puts a node and its callout under the canvas controls', () => {
  const room = { top: BUILD_ROOM_PX, above: BUILD_BUBBLE_PX };
  /** Where the node's top lands on screen, measured from the top of the canvas. */
  const nodeTop = (node: { y: number }, canvasHeight: number, zoom: number, center: { y: number }) => canvasHeight / 2 - (center.y - node.y) * zoom;

  it('keeps the bubble clear of the build strip for a tall node in a short canvas', () => {
    const node = { x: 0, y: 1000, width: 240, height: 400 };
    for (const height of [470, 610, 808, 990]) {
      for (const zoom of [0.85, 1, 1.1]) {
        const top = nodeTop(node, height, zoom, cameraCenter(node, { width: 900, height }, zoom, room));
        expect(top - BUILD_BUBBLE_PX).toBeGreaterThanOrEqual(BUILD_ROOM_PX - 0.001);
      }
    }
  });

  it('centres the pair in the free room when there is room to spare', () => {
    const node = { x: 100, y: 200, width: 240, height: 120 };
    const height = 808;
    const center = cameraCenter(node, { width: 1000, height }, 1, room);
    const top = nodeTop(node, height, 1, center);
    const blockTop = top - BUILD_BUBBLE_PX;
    const blockBottom = top + node.height;
    // Equal room above (under the controls) and below (over the bottom margin of 24 px).
    expect(blockTop - BUILD_ROOM_PX).toBeCloseTo(height - 24 - blockBottom, 5);
    expect(center.x).toBe(node.x + node.width / 2);
  });

  it('without a callout keeps the node under the toolbar', () => {
    const node = { x: 0, y: 0, width: 240, height: 700 };
    const center = cameraCenter(node, { width: 800, height: 470 }, 1, { top: TOOLBAR_ROOM_PX, above: 0 });
    expect(nodeTop(node, 470, 1, center)).toBeCloseTo(TOOLBAR_ROOM_PX, 5);
  });
});
