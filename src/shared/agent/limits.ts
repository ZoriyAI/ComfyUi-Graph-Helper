/**
 * The agent's protective limits, in one place so the tool descriptions, the prompt and the Preferences page
 * state the same numbers. The person's own data (graph, chat, catalog) has no cap: these only guard against
 * hostile or runaway input from outside (web pages) and say so where they apply.
 */

/** fetchPage reads at most this many bytes of one web page; the rest is not downloaded. */
export const FETCH_PAGE_BYTE_CAP = 10 * 1024 * 1024;
/** fetchPage returns at most this many characters of a page's text, and says `truncated: true` past it. */
export const FETCH_PAGE_TEXT_CAP = 60_000;
/** Up to this many nodes the prompt lists the whole graph; past it, a compact list and getGraph paging. */
export const PROMPT_FULL_GRAPH_NODES = 300;
/** Default page of getGraph. The model may ask for any page size; there is no maximum. */
export const GRAPH_PAGE_DEFAULT = 200;

/** "10 MB" for the byte cap. */
export function megabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
