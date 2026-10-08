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
    this.pressureLow = cards.getDeviceTriggerCard('pressure_low');
    this.pressureOk = cards.getDeviceTriggerCard('pressure_ok');
    this.modeChanged = cards.getDeviceTriggerCard('mode_changed');

    cards.getConditionCard('flame_is_on')
      .registerRunListener(async ({ device }) => device.getCapabilityValue('flame_on') === true);
    cards.getConditionCard('pressure_below')
      .registerRunListener(async ({ device, bar }) => {
        const p = device.getCapabilityValue('measure_water_pressure');
        return typeof p === 'number' && p < bar;
      });
    cards.getConditionCard('pressure_is_low')
      .registerRunListener(async ({ device }) => device.getCapabilityValue('alarm_water_pressure') === true);
    cards.getConditionCard('mode_is')
      .registerRunListener(async ({ device, mode }) => device.getCapabilityValue('heating_mode') === mode);

    cards.getActionCard('set_flow_temperature')
      .registerRunListener(async ({ device, temperature }) => device.setManualFlow(temperature));
    cards.getActionCard('set_hwc_temperature')
      .registerRunListener(async ({ device, temperature }) => device.setHwcTarget(temperature));
    cards.getActionCard('set_bus_control')
      .registerRunListener(async ({ device, state }) => device.setBusControl(state === 'on'));
    cards.getActionCard('set_mode')
      .registerRunListener(async ({ device, mode }) => device.setMode(mode));
    cards.getActionCard('boost_for')
      .registerRunListener(async ({ device, minutes }) => device.setMode('boost', minutes));
    cards.getActionCard('set_room_temperature')
      .registerRunListener(async ({ device, temperature }) => device.setRoomTarget(temperature));
    cards.getActionCard('set_regulation')
      .registerRunListener(async ({ device, regulation }) => device.setRegulation(regulation));
    cards.getActionCard('reset_gas')
      .registerRunListener(async ({ device, value }) => device.resetGas(value));
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
          },
          store: {
            ident, control: false, flow: state.flowTempDesired || 40, hwc: state.hwcTempDesired || 50,
          },
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
