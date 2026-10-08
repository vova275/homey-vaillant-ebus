'use strict';

// Endpoints for the app settings page.
module.exports = {
  async getSensors({ homey }) {
    return homey.app.sensors.list();
  },
  async getPreview({ homey }) {
    const s = homey.app.sensors;
    const [room, outdoor] = await Promise.all([s.room(), s.outdoor()]);
    return { room, outdoor };
  },
};
