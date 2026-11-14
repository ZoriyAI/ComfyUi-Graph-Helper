/**
 * The addresses the helper's page reader may open in a conversation: the ones the person wrote in their own
 * messages, and the ones a web search returned in it. Anything else (an address found in a model description, a
 * workflow note or a page) is refused, so text from outside cannot make the helper send the person's data to an
 * address of its choosing. Exact addresses: the fragment aside, the address must be the one written or returned.
 */

/** The address as compared: parsed, fragment dropped; null for anything that is not http(s). */
export function normalLink(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url.href;
}

/** Every http(s) address in a text, as written (trailing punctuation of the sentence left out). */
export function linksInText(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`«»]+/gi)) {
    const raw = match[0].replace(/[.,;:!?)\]}]+$/, '');
    const link = normalLink(raw);
    if (link && !found.includes(link)) found.push(link);
  }
  return found;
}

/** Most addresses one conversation keeps: older ones are dropped first. */
const LINKS_PER_CONVERSATION = 500;

export class ConversationLinks {
  private readonly links = new Set<string>();

  add(urls: Iterable<string>): void {
    for (const url of urls) {
      const link = normalLink(url);
      if (!link) continue;
      this.links.delete(link);
      this.links.add(link);
      if (this.links.size > LINKS_PER_CONVERSATION) this.links.delete(this.links.values().next().value as string);
    }
  }

  allows(url: string): boolean {
    const link = normalLink(url);
    return link !== null && this.links.has(link);
  }
}

const byProject = new Map<string, ConversationLinks>();

/** The links of one project's conversation, kept for this run of the app. */
export function conversationLinks(projectId: string): ConversationLinks {
  let links = byProject.get(projectId);
  if (!links) {
    links = new ConversationLinks();
    byProject.set(projectId, links);
  }
  return links;
}

/** Chat history cleared: the addresses written or found in it go too. */
export function forgetConversationLinks(projectId?: string): void {
  if (projectId === undefined) byProject.clear();
  else byProject.delete(projectId);
}

/** What the model is told when it asks for an address that is not in the conversation. */
export const LINK_NOT_IN_CONVERSATION = 'This address is not in the conversation, so it was not opened. Pages can be read only at addresses the person wrote in the chat or a web search returned. Ask the person to paste the address in the chat if they want it read.';
