/**
 * ComfyUI's colour palette for nodes and groups (LGraphCanvas.node_colors in its frontend): a node stores the title
 * colour (`color`) and the body colour (`bgcolor`), a group one colour (`groupcolor` in the palette). The editing
 * commands write these values (main/commands/editOps.ts) and the menus tick the entry a stored colour belongs to.
 */
import type { NODE_COLORS } from '../commands/types';

export type ColorName = typeof NODE_COLORS[number];

/** Title colour, body colour and group colour of each palette entry. */
export const NODE_PALETTE: Record<ColorName, { color: string; bgcolor: string; groupcolor: string }> = {
  red: { color: '#322', bgcolor: '#533', groupcolor: '#A88' },
  brown: { color: '#332922', bgcolor: '#593930', groupcolor: '#b06634' },
  green: { color: '#232', bgcolor: '#353', groupcolor: '#8A8' },
  blue: { color: '#223', bgcolor: '#335', groupcolor: '#88A' },
  pale_blue: { color: '#2a363b', bgcolor: '#3f5159', groupcolor: '#3f789e' },
  cyan: { color: '#233', bgcolor: '#355', groupcolor: '#8AA' },
  purple: { color: '#323', bgcolor: '#535', groupcolor: '#a1309b' },
  yellow: { color: '#432', bgcolor: '#653', groupcolor: '#b58b2a' },
  black: { color: '#222', bgcolor: '#000', groupcolor: '#444' },
};

/** The palette entry a stored colour belongs to, so the menu can tick it; null for none or a colour of one's own. */
export function paletteNameOf(color: unknown): ColorName | null {
  if (typeof color !== 'string') return null;
  const lower = color.toLowerCase();
  for (const [name, entry] of Object.entries(NODE_PALETTE) as Array<[ColorName, typeof NODE_PALETTE[ColorName]]>) {
    if (entry.color.toLowerCase() === lower || entry.groupcolor.toLowerCase() === lower) return name;
  }
  return null;
}

