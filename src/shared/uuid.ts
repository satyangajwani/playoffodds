// UUIDv7 — time-ordered, no external dep. Spec: https://datatracker.ietf.org/doc/rfc9562/
// Used for snapshot IDs so they sort by creation time without a separate index.

export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);

  // 48-bit millisecond timestamp (big-endian, bytes 0..5)
  const unixMs = BigInt(now);
  bytes[0] = Number((unixMs >> 40n) & 0xffn);
  bytes[1] = Number((unixMs >> 32n) & 0xffn);
  bytes[2] = Number((unixMs >> 24n) & 0xffn);
  bytes[3] = Number((unixMs >> 16n) & 0xffn);
  bytes[4] = Number((unixMs >> 8n) & 0xffn);
  bytes[5] = Number(unixMs & 0xffn);

  // Fill the remaining 10 bytes with crypto-random data, then patch version + variant nibbles.
  crypto.getRandomValues(bytes.subarray(6, 16));
  // Version 7 in high nibble of byte 6
  bytes[6] = (0x70 | ((bytes[6] ?? 0) & 0x0f)) & 0xff;
  // Variant 10 in high nibble of byte 8
  bytes[8] = (0x80 | ((bytes[8] ?? 0) & 0x3f)) & 0xff;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
