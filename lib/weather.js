'use strict';

// Outdoor temperature for the Homey's own location, from Open-Meteo (no key),
// for the heating curve when no outdoor sensor reports through a Flow.

const TTL = 15 * 60e3;

class Weather {
  constructor(homey, log = () => {}) {
    this.homey = homey;
    this.log = log;
    this.cache = { at: 0, value: null };
  }

  async temperature() {
    if (Date.now() - this.cache.at < TTL) return this.cache.value;
    try {
      const lat = this.homey.geolocation.getLatitude();
      const lon = this.homey.geolocation.getLongitude();
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`);
      const j = await res.json();
      const v = j?.current?.temperature_2m;
      if (typeof v === 'number') this.cache = { at: Date.now(), value: v };
    } catch (err) {
      this.log('weather:', err.message);
    }
    return this.cache.value;
  }
}

module.exports = { Weather };
