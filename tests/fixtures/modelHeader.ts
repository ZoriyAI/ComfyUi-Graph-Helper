export function headerBytes(metadata?: Record<string, string>): Buffer {
  const json = Buffer.from(JSON.stringify({ ...(metadata ? { __metadata__: metadata } : {}), tensor: { dtype: 'F32', shape: [1], data_offsets: [0, 4] } }));
  const prefix = Buffer.alloc(8); prefix.writeBigUInt64LE(BigInt(json.length));
  return Buffer.concat([prefix, json, Buffer.alloc(4)]);
}
