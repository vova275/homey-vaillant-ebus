'use strict';

// Offline checks against telegrams captured from the real boiler (BAI00, 2026-10-08).
const assert = require('assert');
const { crc, escape, fromHex, buildTelegram } = require('../lib/ebus');
const { decodeRead, setModeData } = require('../lib/bai');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };

t('crc of boiler broadcast 03 64 b5 12 02 02 fe = 98', () => {
  assert.strictEqual(crc(fromHex('0364b5120202fe')), 0x98);
});

t('escape', () => {
  assert.deepStrictEqual(escape([0x01, 0xAA, 0xA9, 0x02]), [0x01, 0xA9, 0x01, 0xA9, 0x00, 0x02]);
});

t('buildTelegram', () => {
  assert.deepStrictEqual(buildTelegram(0x31, 0x08, 0xB509, [0x0D, 0x02, 0x00]), [0x31, 0x08, 0xB5, 0x09, 0x03, 0x0D, 0x02, 0x00]);
});

t('WaterPressure 550600 = 1.621 bar ok', () => {
  assert.deepStrictEqual(decodeRead('waterPressure', fromHex('550600')), { value: 1.621, sensor: 0 });
});

t('FlowTempDesired 3002 = 35.0', () => {
  assert.deepStrictEqual(decodeRead('flowTempDesired', fromHex('3002')), { value: 35 });
});

t('Flame f0 = off', () => {
  assert.deepStrictEqual(decodeRead('flame', fromHex('f0')), { value: 0xF0 });
});

t('ModulationDesired 4a01 = 33.0 %', () => {
  assert.deepStrictEqual(decodeRead('modulation', fromHex('4a01')), { value: 33 });
});

t('Status01 decode', () => {
  const r = decodeRead('status01', fromHex('413c0080ff3f0000'.slice(0, 2 * 7) + '00'));
  assert.strictEqual(r.flow, 32.5);
  assert.strictEqual(r.return, 30);
  assert.strictEqual(r.outdoor, null);
});

t('SetMode 35/46 matches the telegram the boiler accepted', () => {
  assert.deepStrictEqual(setModeData({ flowTemp: 35, hwcTemp: 46 }), fromHex('0000465cffff000000'));
});

t('SetMode heating off sets bit 0', () => {
  assert.strictEqual(setModeData({ flowTemp: 35, hwcTemp: 46, disableHc: true })[6], 0x01);
});

console.log(`\n${n} tests passed`);
