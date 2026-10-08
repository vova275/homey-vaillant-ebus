'use strict';

// Endpoints for the app settings page.
module.exports = {
  async getSensors({ homey }) {
    return homey.app.sensors.list();
  },
  async getSwitches({ homey }) {
    return homey.app.sensors.switches();
  },
  async getPreview({ homey }) {
    const s = homey.app.sensors;
    const [room, outdoor, valves] = await Promise.all([s.room(), s.outdoor(), s.valves()]);
    return { room, outdoor, valves };
  },
};
