const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  const json = JSON.stringify(value);
  if (json === undefined)
    throw new TypeError('State must contain only JSON values');
  return json;
}

/** Returns FNV-1a 64 of canonical JSON as a fixed-width hex string. */
export function hashState(state: unknown): string {
  const json = canonical(state);
  let hash = FNV_OFFSET;
  for (let index = 0; index < json.length; index += 1) {
    const code = json.charCodeAt(index);
    // Hash UTF-8 bytes, including surrogate pairs, so the result is platform stable.
    if (code < 0x80) hash = ((hash ^ BigInt(code)) * FNV_PRIME) & UINT64_MASK;
    else {
      const point = json.codePointAt(index)!;
      if (point > 0xffff) index += 1;
      const bytes =
        point < 0x800
          ? [0xc0 | (point >> 6), 0x80 | (point & 0x3f)]
          : point < 0x10000
            ? [
                0xe0 | (point >> 12),
                0x80 | ((point >> 6) & 0x3f),
                0x80 | (point & 0x3f),
              ]
            : [
                0xf0 | (point >> 18),
                0x80 | ((point >> 12) & 0x3f),
                0x80 | ((point >> 6) & 0x3f),
                0x80 | (point & 0x3f),
              ];
      for (const byte of bytes)
        hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & UINT64_MASK;
    }
  }
  return hash.toString(16).padStart(16, '0');
}
