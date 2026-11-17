/** Bounded persistent drafts and a dependency-free, UTF-8, uncompressed ZIP writer. Never runs submitted code. */
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { crc32 } from 'node:zlib';
import { z } from 'zod';
import { carriesSecret } from '../../shared/config/draft';
import type { ExtensionDraft, ExtensionProposal } from '../../shared/contracts/extensions';
import { DraftStore } from '../agent/draftStore';

const port = z.object({ name: z.string().min(1).max(100), type: z.string().min(1).max(100) }).strict();
export const extensionSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/), name: z.string().min(1).max(160), purpose: z.string().min(1).max(4000),
  inputs: z.array(port).max(40), outputs: z.array(port).min(1).max(40), dependencies: z.array(z.string().max(200)).max(30),
  files: z.array(z.object({ path: z.string().min(1).max(180), content: z.string().max(40000) }).strict()).min(2).max(32),
}).strict();

/** ZIP file entries use a fixed package prefix; no filesystem, executable bit, symlink or extraction is involved. */
export function sourceZip(slug: string, files: ExtensionProposal['files']): Buffer {
  const chunks: Buffer[] = []; const directory: Buffer[] = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(`${slug}/${file.path}`, 'utf8'); const body = Buffer.from(file.content, 'utf8'); const crc = crc32(body);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    chunks.push(local, name, body); directory.push(central, name); offset += local.length + name.length + body.length;
  }
  const size = directory.reduce((n, b) => n + b.length, 0); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...directory, end]);
}

function readProposal(input: unknown): ExtensionProposal {
    const proposal = extensionSchema.parse(input); const seen = new Set<string>(); let bytes = 0;
    for (const file of proposal.files) {
      if (!/^[a-zA-Z0-9_./-]+\.(py|js|json|md|toml|txt)$/.test(file.path) || file.path.startsWith('/') || file.path.split('/').some((p) => !p || p === '.' || p === '..') || file.path.toLowerCase() === 'nodewise-extension.json' || seen.has(file.path.toLowerCase())) throw Error('Use unique relative source paths; nodewise-extension.json is reserved.');
      seen.add(file.path.toLowerCase()); bytes += Buffer.byteLength(file.content);
    }
    if (bytes > 256000) throw Error('The source package exceeds 256 KB.');
    if (!seen.has('__init__.py') || !seen.has('readme.md')) throw Error('Include __init__.py and README.md with installation, ports, dependencies and limitations.');
    if (!proposal.files.some((f) => f.path.endsWith('.py') && /NODE_CLASS_MAPPINGS\s*(?::[^=\n]+)?=|(?:async\s+)?def\s+comfy_entrypoint\s*\(/.test(f.content))) throw Error('Include a native ComfyUI V1 NODE_CLASS_MAPPINGS or V3 comfy_entrypoint registration.');
    if (carriesSecret(proposal)) throw Error('Remove credentials and secrets from the source package.');
    return proposal;
}

function makeDraft(proposal: ExtensionProposal, id: string, createdAt: number, origin: ExtensionDraft['origin']): ExtensionDraft {
  const manifest = { format: 'nodewise-extension', version: 1, name: proposal.name, purpose: proposal.purpose, inputs: proposal.inputs, outputs: proposal.outputs, dependencies: proposal.dependencies, verification: 'source-only' };
  return { ...structuredClone(proposal), id, createdAt, origin, verification: 'source-only', archiveBase64: sourceZip(proposal.slug, [...proposal.files, { path: 'nodewise-extension.json', content: JSON.stringify(manifest, null, 2) }]).toString('base64') };
}

/** Revalidate stored sources and rebuild the archive: a corrupt stored ZIP must never bypass path checks. */
function readDraft(value: unknown): ExtensionDraft | null {
  if (!value || typeof value !== 'object') return null;
  const { id, createdAt, origin, verification, archiveBase64: _archive, persistent: _persistent, ...source } = value as ExtensionDraft;
  if (typeof id !== 'string' || !id || id.length > 64 || !Number.isFinite(createdAt)
    || !['assistant', 'starter'].includes(origin) || verification !== 'source-only') return null;
  try { return makeDraft(readProposal(source), id, createdAt, origin); } catch { return null; }
}

export class ExtensionDrafts {
  private readonly drafts = new DraftStore<ExtensionDraft>('extension', 12, readDraft);
  attach(db: Database.Database, mayPersist?: () => boolean, containsHeldSecret?: (text: string) => boolean): void { this.drafts.attach(db, mayPersist, containsHeldSecret); }
  clearMemory(projectId: string): void { this.drafts.clearMemory(projectId); }

  add(input: unknown, origin: ExtensionDraft['origin'] = 'assistant', projectId?: string): ExtensionDraft {
    const draft = makeDraft(readProposal(input), randomUUID(), Date.now(), origin);
    return this.drafts.put(draft, projectId);
  }
  get(id: string): ExtensionDraft | null { return this.drafts.get(id); }
}
export const extensionDrafts = new ExtensionDrafts();
