'use strict';

// Values the user's own Flows report to the boiler device: room temperatures,
// an outdoor temperature and zone valve states. Kept free of Homey so it can be
// tested offline; the device stores toJSON() and passes it back on start.
//
// Readings expire: a sensor that stopped reporting must not hold the room at a
// stale value for ever. Valves do not expire — a relay that stays open for a
// day is normal, and its Flow only fires when it switches.

class Inputs {
  constructor(saved = {}) {
    this.rooms = { ...(saved.rooms || {}) }; // name -> { v, at }
    this.outdoorReading = saved.outdoor || null; // { v, at }
    this.valves = { ...(saved.valves || {}) }; // "1".."8" -> boolean
  }

  reportRoom(value, name = '', now = Date.now()) {
    this.rooms[String(name || '').trim()] = { v: value, at: now };
  }

  /** Average of the room readings younger than maxAgeMs, or null. */
  room(maxAgeMs, now = Date.now()) {
    const fresh = Object.values(this.rooms).filter((r) => now - r.at <= maxAgeMs).map((r) => r.v);
    if (!fresh.length) return null;
    return Math.round((fresh.reduce((a, b) => a + b, 0) / fresh.length) * 10) / 10;
  }

  reportOutdoor(value, now = Date.now()) {
    this.outdoorReading = { v: value, at: now };
  }

  /** The reported outdoor temperature if younger than maxAgeMs, or null. */
  outdoor(maxAgeMs, now = Date.now()) {
    const r = this.outdoorReading;
    return r && now - r.at <= maxAgeMs ? r.v : null;
  }

  setValve(number, open) {
    this.valves[String(number)] = !!open;
  }

  /**
   * How many of the first `count` valves are open. A valve that has never been
   * reported counts as closed, so the boiler does not heat a zone nobody asked for.
   */
  valveState(count) {
    let open = 0;
    for (let n = 1; n <= count; n++) if (this.valves[String(n)] === true) open++;
    return { selected: count, open };
  }

  toJSON() {
    return { rooms: this.rooms, outdoor: this.outdoorReading, valves: this.valves };
  }
}

module.exports = { Inputs };
