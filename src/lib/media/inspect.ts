/** Bounded header inspection before browser decoding, including animation chunks. */
export function inspectStillRaster(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n" && bytes.length >= 33) {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      if (ascii(offset + 4, 4) === "acTL") return null;
      offset += view.getUint32(offset) + 12;
    }
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 4 < bytes.length;) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      if (marker === 0xff) { offset++; continue; }
      if ([0xd8, 0xd9, 0x01].includes(marker)) { offset += 2; continue; }
      if (marker === 0xda) return null;
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + length + 2 > bytes.length) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 7) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += length + 2;
    }
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    let dimensions = null;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = ascii(offset, 4); const length = view.getUint32(offset + 4, true); const data = offset + 8;
      if (["ANIM", "ANMF"].includes(type)) return null;
      if (data + length > bytes.length) return null;
      if (type === "VP8X" && length >= 10) dimensions = { width: 1 + bytes[data+4] + (bytes[data+5]<<8) + (bytes[data+6]<<16), height: 1 + bytes[data+7] + (bytes[data+8]<<8) + (bytes[data+9]<<16) };
      if (type === "VP8 " && length >= 10 && ascii(data+3, 3) === "\x9d\x01\x2a") dimensions = { width: view.getUint16(data+6, true) & 0x3fff, height: view.getUint16(data+8, true) & 0x3fff };
      if (type === "VP8L" && length >= 5 && bytes[data] === 0x2f) { const bits = view.getUint32(data+1, true); dimensions = { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }; }
      offset += 8 + length + length % 2;
    }
    return dimensions;
  }
  return null;
}
