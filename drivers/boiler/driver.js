'use strict';

const Homey = require('homey');
const { Boiler } = require('../../lib/boiler');

class BoilerDriver extends Homey.Driver {
  async onInit() {
    const cards = this.homey.flow;
    this.flameOn = cards.getDeviceTriggerCard('flame_on');
    this.flameOff = cards.getDeviceTriggerCard('flame_off');
    this.errorChanged = cards.getDeviceTriggerCard('error_changed');
    this.pressureChanged = cards.getDeviceTriggerCard('pressure_changed');

    cards.getConditionCard('flame_is_on')
      .registerRunListener(async ({ device }) => device.getCapabilityValue('flame_on') === true);
    cards.getConditionCard('pressure_below')
      .registerRunListener(async ({ device, bar }) => {
        const p = device.getCapabilityValue('measure_water_pressure');
        return typeof p === 'number' && p < bar;
      });

    cards.getActionCard('set_flow_temperature')
      .registerRunListener(async ({ device, temperature }) => device.setTarget('flow', temperature));
    cards.getActionCard('set_hwc_temperature')
      .registerRunListener(async ({ device, temperature }) => device.setTarget('hwc', temperature));
    cards.getActionCard('set_bus_control')
      .registerRunListener(async ({ device, state }) => device.setBusControl(state === 'on'));
  }

  async onPair(session) {
    let found = null;

    session.setHandler('connect', async ({ transport, host, port, address }) => {
      const addr = parseInt(address || '31', 16);
      const boiler = new Boiler({
        transport, host, port: Number(port), address: addr, log: (...a) => this.log(...a),
      });
      try {
        const ident = await boiler.identify();
        const state = await boiler.poll();
        found = {
          name: `Vaillant ${ident.id}`,
          data: { id: `${host}:${port}:08` },
          settings: {
            transport, host, port: Number(port), address: addr.toString(16),
            panel_flow: state.flowTempDesired || 0,
            panel_hwc: state.hwcTempDesired || 0,
          },
          store: { ident },
        };
        return { ident, state };
      } finally {
        boiler.close();
      }
    });

    session.setHandler('list_devices', async () => (found ? [found] : []));
  }
}

module.exports = BoilerDriver;
