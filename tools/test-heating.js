'use strict';

const assert = require('assert');
const {
  curveFlow, roomTarget, step, gasUsed,
} = require('../lib/heating');
const { describe } = require('../lib/fcodes');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };
const near = (a, b, eps = 0.6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

const cfg = {
  comfort: 21, ecoDelta: 3, away: 10, slope: 1.2, shift: 0, minFlow: 25, maxFlow: 70,
  heatingLimit: 18, roomGain: 3, roomIntegral: 2, roomHyst: 0.5, boostFlow: 70,
};

t('curve: slope 1.2, room 20, -10 outside ≈ 57 °C', () => near(curveFlow({ room: 20, outdoor: -10, slope: 1.2 }), 57));
t('curve: slope 1.2, room 20, +5 outside ≈ 41 °C', () => near(curveFlow({ room: 20, outdoor: 5, slope: 1.2 }), 41));
t('curve: warmer outside than inside = room temperature', () => assert.strictEqual(curveFlow({ room: 20, outdoor: 22, slope: 1.2 }), 20));
t('curve rises with slope', () => assert.ok(curveFlow({ room: 20, outdoor: 0, slope: 1.6 }) > curveFlow({ room: 20, outdoor: 0, slope: 1.0 })));

t('modes', () => {
  assert.strictEqual(roomTarget('comfort', cfg), 21);
  assert.strictEqual(roomTarget('eco', cfg), 18);
  assert.strictEqual(roomTarget('away', cfg), 10);
});

t('step: summer cutoff', () => {
  const r = step({ mode: 'comfort', regulation: 'curve', outdoor: 19, room: 20 }, cfg);
  assert.strictEqual(r.heating, false);
});

t('step: cold room raises flow above plain curve', () => {
  const plain = step({ mode: 'comfort', regulation: 'curve', outdoor: 0, room: null }, cfg).flow;
  const cold = step({ mode: 'comfort', regulation: 'curve', outdoor: 0, room: 19 }, cfg).flow;
  assert.ok(cold > plain, `${cold} > ${plain}`);
});

t('step: room reached switches heating off, back on at target', () => {
  let r = step({ mode: 'comfort', regulation: 'curve', outdoor: 0, room: 21.6, now: 1 }, cfg);
  assert.strictEqual(r.heating, false);
  r = step({ mode: 'comfort', regulation: 'curve', outdoor: 0, room: 21.2, now: 2 }, cfg, r.state);
  assert.strictEqual(r.heating, false, 'hysteresis keeps it off');
  r = step({ mode: 'comfort', regulation: 'curve', outdoor: 0, room: 20.9, now: 3 }, cfg, r.state);
  assert.strictEqual(r.heating, true);
});

t('step: integral walks up when the room stays cold', () => {
  let s = {};
  let r;
  for (let i = 0; i <= 12; i++) { r = step({ mode: 'comfort', regulation: 'curve', outdoor: 0, room: 20, now: i * 5 * 60e3 }, cfg, s); s = r.state; }
  assert.ok(s.integral > 1.5, `integral ${s.integral}`);
});

t('step: clamps to max flow', () => {
  assert.strictEqual(step({ mode: 'comfort', regulation: 'curve', outdoor: -30, room: 15 }, cfg).flow, 70);
});

t('step: boost, off, manual', () => {
  assert.deepStrictEqual([step({ mode: 'boost' }, cfg).flow, step({ mode: 'boost' }, cfg).heating], [70, true]);
  assert.strictEqual(step({ mode: 'off' }, cfg).heating, false);
  assert.strictEqual(step({ mode: 'comfort', regulation: 'manual', manualFlow: 45 }, cfg).flow, 45);
});

t('gas: 24 kW boiler at 50 % for 1 h ≈ 1.33 m³', () => {
  const g = gasUsed({ flame: true, modulation: 50, dtMs: 3600e3 }, { maxKw: 24, minKw: 8, kwhPerM3: 9.5, efficiency: 0.95 });
  near(g.m3, 12 / 0.95 / 9.5, 0.01);
});

t('gas: minimum power applies at low modulation, none without flame', () => {
  const p = { maxKw: 24, minKw: 8, kwhPerM3: 9.5, efficiency: 0.95 };
  assert.strictEqual(gasUsed({ flame: true, modulation: 10, dtMs: 1 }, p).kw, 8);
  assert.strictEqual(gasUsed({ flame: false, modulation: 50, dtMs: 1000 }, p).m3, 0);
});

t('fault codes', () => {
  assert.strictEqual(describe(28), 'F.28 No ignition at start-up');
  assert.strictEqual(describe(5), 'F.05 Unknown fault');
});

console.log(`\n${n} tests passed`);
