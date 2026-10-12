'use strict';

const assert = require('assert');
const { Inputs } = require('../lib/inputs');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`ok  ${name}`); };
const MIN = 60e3;

t('room: no readings -> null', () => {
  assert.strictEqual(new Inputs().room(180 * MIN, 0), null);
});

t('room: sensors are averaged by name, a repeat replaces', () => {
  const i = new Inputs();
  i.reportRoom(20.0, 'Living', 0);
  i.reportRoom(22.0, 'Bedroom', 0);
  i.reportRoom(21.0, 'Living', 1000);
  assert.strictEqual(i.room(180 * MIN, 2000), 21.5);
});

t('room: an empty sensor name is one sensor', () => {
  const i = new Inputs();
  i.reportRoom(19, undefined, 0);
  i.reportRoom(20, '', 0);
  assert.strictEqual(i.room(180 * MIN, 0), 20);
});

t('room: stale sensors drop out', () => {
  const i = new Inputs();
  i.reportRoom(15, 'Dead', 0);
  i.reportRoom(21, 'Alive', 170 * MIN);
  assert.strictEqual(i.room(180 * MIN, 200 * MIN), 21);
  assert.strictEqual(i.room(180 * MIN, 400 * MIN), null);
});

t('outdoor: fresh value, then expired', () => {
  const i = new Inputs();
  i.reportOutdoor(-4.5, 0);
  assert.strictEqual(i.outdoor(180 * MIN, 60 * MIN), -4.5);
  assert.strictEqual(i.outdoor(180 * MIN, 181 * MIN), null);
});

t('valves: unreported counts as closed, beyond count ignored', () => {
  const i = new Inputs();
  i.setValve(1, true);
  i.setValve(3, true);
  i.setValve(5, true);
  assert.deepStrictEqual(i.valveState(3), { selected: 3, open: 2 });
  assert.deepStrictEqual(i.valveState(0), { selected: 0, open: 0 });
  i.setValve(1, false);
  assert.deepStrictEqual(i.valveState(3), { selected: 3, open: 1 });
});

t('state survives a restart through toJSON', () => {
  const a = new Inputs();
  a.reportRoom(21, 'Living', 0);
  a.reportOutdoor(3, 0);
  a.setValve(2, true);
  const b = new Inputs(JSON.parse(JSON.stringify(a.toJSON())));
  assert.strictEqual(b.room(MIN, 0), 21);
  assert.strictEqual(b.outdoor(MIN, 0), 3);
  assert.deepStrictEqual(b.valveState(2), { selected: 2, open: 1 });
});

console.log(`\n${n} tests passed`);
