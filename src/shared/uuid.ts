// UUIDv7 — time-ordered, no external dep. Spec: https://datatracker.ietf.org/doc/rfc9562/
// Used for snapshot IDs so they sort by creation time without a separate index.

export function uuidv7(now: number = Date.now()): string {
  const unixMs = BigInt(now);
  const bytes = new Uint8Array(16);
  // 48-bit millisecond timestamp
  bytes[0] = Number((unixMs >> 40n) & 0xffn);
  bytes[1] = Number((unixMs >> 32n) & 0xffn);
  bytes[2] = Number((unixMs >> 24n) & 0xffn);
  bytes[3] = Number((unixMs >> 16n) & 0xffn);
  bytes[4] = Number((unixMs >> 8n) & 0xffn);
  bytes[5] = Number(unixMs & 0xffn);
  // version 7
  const rand = new Uint8Array(10);
  crypto.getRandomValues(rand);
  bytes[6] = (0x70 | (rand[0]! & 0x0f)) & 0xff;
  bytes[7] = rand[1]!;
  // variant 10xxxxxx
  bytes[8] = (0x80 | (rand[2]! & 0x3f)) & 0xff;
  bytes[9] = rand[3]!;
  bytes[10] = rand[4]!;
  bytes[11] = rand[5]!;
  bytes[12] = rand[6]!;
  bytes[13] = rand[7]!;
  bytes[14] = rand[8]!;
  bytes[15] = rand[9]!;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
