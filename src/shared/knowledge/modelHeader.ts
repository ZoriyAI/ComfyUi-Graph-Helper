/** A user-selected safetensors header. Read only the header, never upload or execute tensor weights. */
import { stringifyMetadata } from './enrichment';

export const MODEL_HEADER_LIMIT = 64 * 1024 * 1024;
export type HeaderReadError = 'wrongFile' | 'tooLarge' | 'invalid' | 'readFailed';
export interface SelectedModelHeader {
  fileName: string;
  fileSize: number;
  headerBytes: number;
  metadata: Record<string, string>;
}

/** Small file interface also permits bounded reads in tests without allocating model weights. */
interface HeaderFile {
  name: string;
  size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

export class ModelHeaderError extends Error {
  constructor(readonly code: HeaderReadError) { super(code); }
}

/** Filename and tensor bounds are checked before a header can repair a catalogue entry. */
export async function readSelectedModelHeader(file: HeaderFile, expectedName: string): Promise<SelectedModelHeader> {
  const basename = expectedName.replace(/\\/g, '/').split('/').pop();
  if (file.name !== basename || !/\.(safetensors|sft)$/i.test(file.name)) throw new ModelHeaderError('wrongFile');
  try {
    if (!Number.isSafeInteger(file.size) || file.size < 10) throw new ModelHeaderError('invalid');
    const prefix = await file.slice(0, 8).arrayBuffer();
    if (prefix.byteLength !== 8) throw new ModelHeaderError('invalid');
    const length = new DataView(prefix).getBigUint64(0, true);
    if (length > BigInt(MODEL_HEADER_LIMIT)) throw new ModelHeaderError('tooLarge');
    const headerBytes = Number(length);
    if (headerBytes < 2 || headerBytes + 8 > file.size) throw new ModelHeaderError('invalid');
    const bytes = await file.slice(8, 8 + headerBytes).arrayBuffer();
    if (bytes.byteLength !== headerBytes) throw new ModelHeaderError('invalid');
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ModelHeaderError('invalid');
    const header = parsed as Record<string, unknown>;
    const tensors = Object.entries(header).filter(([key]) => key !== '__metadata__');
    if (!tensors.length) throw new ModelHeaderError('invalid');
    for (const [, tensor] of tensors) {
      if (!tensor || typeof tensor !== 'object') throw new ModelHeaderError('invalid');
      const { dtype, shape, data_offsets: offsets } = tensor as Record<string, unknown>;
      if (typeof dtype !== 'string' || !Array.isArray(shape) || !shape.every(n => Number.isSafeInteger(n) && n >= 0)
        || !Array.isArray(offsets) || offsets.length !== 2 || !offsets.every(n => Number.isSafeInteger(n) && n >= 0)
        || offsets[0] > offsets[1] || offsets[1] > file.size - 8 - headerBytes) throw new ModelHeaderError('invalid');
    }
    const metadata = header.__metadata__;
    if (metadata !== undefined && (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)
      || !Object.values(metadata).every(value => typeof value === 'string'))) throw new ModelHeaderError('invalid');
    // Same bounded representation as server enrichment: long training-statistic values are not transferred.
    const cleaned = stringifyMetadata(metadata);
    return { fileName: file.name, fileSize: file.size, headerBytes,
      metadata: Object.fromEntries(Object.entries(cleaned).filter(([key]) => key.length <= 256 && !['__proto__', 'prototype', 'constructor'].includes(key))) };
  } catch (error) {
    if (error instanceof ModelHeaderError) throw error;
    throw new ModelHeaderError(error instanceof SyntaxError || error instanceof TypeError ? 'invalid' : 'readFailed');
  }
}
