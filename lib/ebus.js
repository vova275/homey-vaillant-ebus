'use strict';

// eBUS protocol primitives: CRC, escaping, telegram building and the data types
// the Vaillant BAI messages use. Kept free of any transport so the same code
// serves ebusd ("hex" command) and a direct enhanced-protocol adapter.

const SYN = 0xAA;
const ESC = 0xA9;
const ACK = 0x00;
const NAK = 0xFF;

// CRC-8, polynomial 0x9B, as ebusd computes it: over the bytes as they go on the
// wire, i.e. after escaping.
const CRC_TABLE = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let b = 0; b < 8; b++) c = (c & 0x80) ? ((c << 1) ^ 0x9B) & 0xFF : (c << 1) & 0xFF;
    t[i] = c;
  }
  return t;
})();

function crcByte(crc, byte) {
  return CRC_TABLE[crc] ^ byte;
}

/** CRC over unescaped bytes: each byte is escaped first, as on the wire. */
function crc(bytes) {
  let c = 0;
  for (const b of bytes) {
    if (b === ESC) { c = crcByte(c, ESC); c = crcByte(c, 0x00); }
    else if (b === SYN) { c = crcByte(c, ESC); c = crcByte(c, 0x01); }
    else c = crcByte(c, b);
  }
  return c;
}

function escape(bytes) {
  const out = [];
  for (const b of bytes) {
    if (b === ESC) out.push(ESC, 0x00);
    else if (b === SYN) out.push(ESC, 0x01);
    else out.push(b);
  }
  return out;
}

function isMaster(addr) {
  const lo = addr & 0x0F;
  const hi = addr >> 4;
  const ok = (n) => n === 0x0 || n === 0x1 || n === 0x3 || n === 0x7 || n === 0xF;
  return ok(lo) && ok(hi);
}

/** QQ ZZ PB SB NN DD.. (unescaped, without CRC). */
function buildTelegram(qq, zz, pbsb, data) {
  const d = Array.from(data || []);
  return [qq, zz, (pbsb >> 8) & 0xFF, pbsb & 0xFF, d.length, ...d];
}

const hex = (bytes) => Buffer.from(bytes).toString('hex');
const fromHex = (s) => Array.from(Buffer.from(String(s).replace(/\s+/g, ''), 'hex'));

// ---- data types (little endian, Vaillant replacement values => null) ----

const types = {
  UCH: { len: 1, dec: (b) => (b[0] === 0xFF ? null : b[0]) },
  SIN: { len: 2, dec: (b) => { const v = (b[1] << 8 | b[0]) << 16 >> 16; return v === -0x8000 ? null : v; } },
  UIN: { len: 2, dec: (b) => { const v = b[1] << 8 | b[0]; return v === 0xFFFF ? null : v; } },
  ULG: { len: 4, dec: (b) => { const v = (b[3] * 0x1000000) + (b[2] << 16 | b[1] << 8 | b[0]); return v === 0xFFFFFFFF ? null : v; } },
  // D1C: unsigned byte / 2
  D1C: { len: 1, dec: (b) => (b[0] === 0xFF ? null : b[0] / 2), enc: (v) => (v == null ? [0xFF] : [Math.round(v * 2) & 0xFF]) },
  // D2B: signed 16 / 256
  D2B: { len: 2, dec: (b) => { const v = (b[1] << 8 | b[0]) << 16 >> 16; return v === -0x8000 ? null : v / 256; } },
  // D2C: signed 16 / 16
  D2C: { len: 2, dec: (b) => { const v = (b[1] << 8 | b[0]) << 16 >> 16; return v === -0x8000 ? null : v / 16; } },
  // FLT: signed 16 / 1000
  FLT: { len: 2, dec: (b) => { const v = (b[1] << 8 | b[0]) << 16 >> 16; return v === -0x8000 ? null : v / 1000; } },
};

/**
 * Decode slave data (without NN) by a field list [[name, type, divisor?], ...].
 * Throws if the answer is shorter than the definition needs.
 */
function decode(data, fields) {
  const out = {};
  let pos = 0;
  for (const [name, type, div] of fields) {
    const t = types[type];
    if (pos + t.len > data.length) throw new Error(`short answer: ${name} needs ${pos + t.len} bytes, got ${data.length}`);
    let v = t.dec(data.slice(pos, pos + t.len));
    if (v != null && div) v /= div;
    if (name) out[name] = v;
    pos += t.len;
  }
  return out;
}

module.exports = {
  SYN, ESC, ACK, NAK, crc, escape, isMaster, buildTelegram, hex, fromHex, types, decode,
};
