'use strict';

// Temperatures from elsewhere in Homey: the room sensors the user picked on the
// app settings page, and an outdoor value from a sensor or the weather.

const { HomeyAPI } = require('homey-api');

const WEATHER_TTL = 15 * 60e3;

class Sensors {
  constructor(homey, log = () => {}) {
    this.homey = homey;
    this.log = log;
    this.api = null;
    this.weather = { at: 0, value: null };
  }

  async _api() {
    if (!this.api) this.api = await HomeyAPI.createAppAPI({ homey: this.homey });
    return this.api;
  }

  /** All devices that report a temperature, for the settings page. */
  async list() {
    const api = await this._api();
    const [devices, zones] = await Promise.all([api.devices.getDevices(), api.zones.getZones()]);
    return Object.values(devices)
      .filter((d) => d.capabilitiesObj && d.capabilitiesObj.measure_temperature && d.driverId !== 'homey:app:ua.te.its.vaillantebus:boiler')
      .map((d) => ({
        id: d.id,
        name: d.name,
        zone: zones[d.zone]?.name || '',
        value: d.capabilitiesObj.measure_temperature.value,
      }))
      .sort((a, b) => (a.zone + a.name).localeCompare(b.zone + b.name));
  }

  async _temps(ids) {
    if (!ids.length) return [];
    const api = await this._api();
    const out = [];
    for (const id of ids) {
      try {
        const d = await api.devices.getDevice({ id });
        const v = d.capabilitiesObj?.measure_temperature?.value;
        if (typeof v === 'number' && d.available !== false) out.push(v);
      } catch (err) {
        this.log(`sensor ${id}: ${err.message}`);
      }
    }
    return out;
  }

  /** Average of the selected room sensors, or null. */
  async room() {
    const ids = this.homey.settings.get('roomSensors') || [];
    const t = await this._temps(ids);
    if (!t.length) return null;
    return Math.round((t.reduce((a, b) => a + b, 0) / t.length) * 10) / 10;
  }

  /** Outdoor temperature from the chosen source ('weather', a device id, or 'none'). */
  async outdoor() {
    const src = this.homey.settings.get('outdoorSource') || 'weather';
    if (src === 'none') return null;
    if (src !== 'weather') {
      const [v] = await this._temps([src]);
      return v ?? null;
    }
    if (Date.now() - this.weather.at < WEATHER_TTL) return this.weather.value;
    try {
      const lat = this.homey.geolocation.getLatitude();
      const lon = this.homey.geolocation.getLongitude();
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`);
      const j = await res.json();
      const v = j?.current?.temperature_2m;
      if (typeof v === 'number') this.weather = { at: Date.now(), value: v };
    } catch (err) {
      this.log('weather:', err.message);
    }
    return this.weather.value;
  }
}

module.exports = Sensors;
