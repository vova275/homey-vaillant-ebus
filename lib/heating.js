'use strict';

// Room-thermostat logic, kept free of Homey so it can be tested offline:
// weather-compensated heating curve, room-temperature correction, modes.

/**
 * Heating curve as used by most boiler controllers (same shape as the
 * Viessmann/Vaillant curves): flow temperature for a wanted room temperature
 * at a given outdoor temperature. slope ~0.6 floor heating … 1.2 radiators … 2.0 old houses.
 */
function curveFlow({ room, outdoor, slope, shift = 0 }) {
  const dar = outdoor - room; // negative when it is colder outside
  if (dar >= 0) return room + shift;
  const k = 1.4347 + 0.021 * dar + 247.9e-6 * dar * dar;
  return room + shift - slope * dar * k;
}

/** Room target for a mode (comfort target, eco offset, frost protection). */
function roomTarget(mode, { comfort, ecoDelta, away }) {
  if (mode === 'eco') return comfort - ecoDelta;
  if (mode === 'away') return away;
  return comfort;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round05 = (v) => Math.round(v * 2) / 2;

/**
 * One control step. Pure: takes the previous controller state, returns the new
 * one plus what to send to the boiler.
 *
 * inputs:  { mode, regulation, manualFlow, room (avg °C or null), outdoor (°C or null), now (ms) }
 * cfg:     { comfort, ecoDelta, away, slope, shift, minFlow, maxFlow, heatingLimit,
 *            roomGain, roomIntegral, roomHyst, boostFlow }
 * state:   { integral, lastRun, roomOff }
 * returns: { flow, heating, reason, state }
 */
function step(inputs, cfg, state = {}) {
  const st = { integral: 0, roomOff: false, ...state };
  const now = inputs.now ?? Date.now();
  const dtH = st.lastRun ? clamp((now - st.lastRun) / 3600e3, 0, 0.25) : 0;
  st.lastRun = now;

  if (inputs.mode === 'off') return { flow: cfg.minFlow, heating: false, reason: 'mode off', state: st };
  if (inputs.mode === 'boost') return { flow: cfg.boostFlow, heating: true, reason: 'boost', state: st };
  if (inputs.regulation === 'manual') {
    return { flow: clamp(inputs.manualFlow, cfg.minFlow, cfg.maxFlow), heating: true, reason: 'manual', state: st };
  }

  const target = roomTarget(inputs.mode, cfg);
  const outdoor = inputs.outdoor;

  // summer: no heating when it is warm enough outside
  if (outdoor != null && outdoor >= cfg.heatingLimit) {
    st.integral = 0;
    return { flow: cfg.minFlow, heating: false, reason: `outdoor ${outdoor} ≥ limit ${cfg.heatingLimit}`, state: st };
  }

  // without an outdoor value the curve runs at a mild 5 °C and the room correction does the rest
  let flow = curveFlow({ room: target, outdoor: outdoor ?? 5, slope: cfg.slope, shift: cfg.shift });
  let reason = `curve ${target}°/${outdoor ?? '5?'}°`;

  if (inputs.room != null) {
    const err = target - inputs.room; // > 0: room too cold
    // slow integral so a house that runs constantly too warm/cold walks the curve
    st.integral = clamp(st.integral + err * cfg.roomIntegral * dtH, -10, 10);
    flow += cfg.roomGain * err + st.integral;
    reason += ` room ${inputs.room}° (${err >= 0 ? '+' : ''}${err.toFixed(1)})`;

    // room reached: switch heating off, back on once it drops to the target
    if (inputs.room >= target + cfg.roomHyst) st.roomOff = true;
    else if (inputs.room <= target) st.roomOff = false;
    if (st.roomOff) return { flow: round05(clamp(flow, cfg.minFlow, cfg.maxFlow)), heating: false, reason: `${reason}, room reached`, state: st };
  }

  return { flow: round05(clamp(flow, cfg.minFlow, cfg.maxFlow)), heating: true, reason, state: st };
}

/**
 * Gas estimate from burner state. Modulation is relative to the nominal power;
 * the burner cannot go below its minimum. Returns m³ burnt in dtMs.
 */
function gasUsed({ flame, modulation, dtMs }, { maxKw, minKw, kwhPerM3, efficiency }) {
  if (!flame || !(dtMs > 0)) return { kw: 0, m3: 0 };
  const out = Math.max(minKw, maxKw * clamp(modulation ?? 0, 0, 100) / 100);
  const input = out / efficiency;
  return { kw: out, m3: (input * dtMs / 3600e3) / kwhPerM3 };
}

module.exports = {
  curveFlow, roomTarget, step, gasUsed, clamp,
};
