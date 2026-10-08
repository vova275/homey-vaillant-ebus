'use strict';

const Homey = require('homey');
const { Boiler } = require('../../lib/boiler');

// The boiler keeps the last bus setpoint for a long time on its own (observed
// > 8 min with no refresh), so switching control off has to send the panel
// values back explicitly instead of just going quiet.

class BoilerDevice extends Homey.Device {
  async onInit() {
    this.boiler = null;
    this.pollTimer = null;
    this.controlTimer = null;
    this.failures = 0;

    if (!this.hasCapability('bus_control')) await this.addCapability('bus_control');

    this.registerCapabilityListener('target_temperature', (v) => this.setTarget('flow', v));
    this.registerCapabilityListener('target_temperature.hwc', (v) => this.setTarget('hwc', v));
    this.registerCapabilityListener('onoff', (v) => this.setHeating(v));
    this.registerCapabilityListener('bus_control', (v) => this.setBusControl(v));

    // restore what Homey last asked for, defaulting to the panel values
    const s = this.getSettings();
    this.targets = {
      flow: this.getStoreValue('flow') ?? (s.panel_flow || 40),
      hwc: this.getStoreValue('hwc') ?? (s.panel_hwc || 50),
      heating: this.getStoreValue('heating') ?? true,
      control: this.getStoreValue('control') ?? false,
    };
    await this._show();

    this._connect();
  }

  _connect() {
    if (this.boiler) this.boiler.close();
    const s = this.getSettings();
    this.boiler = new Boiler({
      transport: s.transport,
      host: s.host,
      port: s.port,
      address: parseInt(s.address || '31', 16),
      log: (...a) => this.log(...a),
    });
    this._schedule();
  }

  _schedule() {
    this.homey.clearInterval(this.pollTimer);
    this.homey.clearInterval(this.controlTimer);
    const s = this.getSettings();
    this.pollTimer = this.homey.setInterval(() => this.poll(), s.poll_interval * 1000);
    this.controlTimer = this.homey.setInterval(() => this._refresh(), s.control_interval * 1000);
    this.poll();
  }

  async _show() {
    const set = (c, v) => this.hasCapability(c) && this.setCapabilityValue(c, v).catch(this.error);
    await set('target_temperature', this.targets.flow);
    await set('target_temperature.hwc', this.targets.hwc);
    await set('onoff', this.targets.heating);
    await set('bus_control', this.targets.control);
  }

  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const st = await this.boiler.poll();
      if (st.flowTemp === undefined && st.pressure === undefined) throw new Error('no answers from boiler');
      this.failures = 0;
      if (!this.getAvailable()) await this.setAvailable();
      await this._apply(st);
    } catch (err) {
      this.failures++;
      this.log('poll failed:', err.message);
      if (this.failures >= 3) await this.setUnavailable(err.message).catch(this.error);
    } finally {
      this.polling = false;
    }
  }

  async _apply(st) {
    const upd = async (cap, v) => {
      if (v === undefined || !this.hasCapability(cap)) return;
      if (this.getCapabilityValue(cap) !== v) await this.setCapabilityValue(cap, v).catch(this.error);
    };
    const prevFlame = this.getCapabilityValue('flame_on');
    const prevPressure = this.getCapabilityValue('measure_water_pressure');
    const prevError = this.getCapabilityValue('boiler_error');

    await upd('measure_temperature', st.flowTemp);
    await upd('measure_temperature.return', st.returnTemp);
    await upd('measure_temperature.hwc', st.hwcTemp);
    await upd('measure_water_pressure', st.pressure);
    await upd('measure_modulation', st.modulation);
    await upd('flame_on', st.flame);
    await upd('hwc_demand', st.hwcDemand);

    if (st.errors !== undefined) {
      const text = st.errors.length ? st.errors.map((e) => `F.${String(e).padStart(2, '0')}`).join(', ') : 'OK';
      await upd('boiler_error', text);
      await upd('alarm_generic', st.errors.length > 0);
      if (prevError != null && prevError !== text) {
        this.driver.errorChanged.trigger(this, { error: text, active: st.errors.length > 0 }).catch(this.error);
      }
    }
    if (st.flame !== undefined && prevFlame != null && prevFlame !== st.flame) {
      (st.flame ? this.driver.flameOn : this.driver.flameOff).trigger(this).catch(this.error);
    }
    if (st.pressure != null && prevPressure != null && Math.abs(prevPressure - st.pressure) >= 0.05) {
      this.driver.pressureChanged.trigger(this, { pressure: st.pressure }).catch(this.error);
    }

    // while Homey is not in control the boiler runs on its panel: remember those values
    if (!this.targets.control) {
      const s = this.getSettings();
      const patch = {};
      if (st.flowTempDesired >= 20 && st.flowTempDesired !== s.panel_flow) patch.panel_flow = st.flowTempDesired;
      if (st.hwcTempDesired >= 30 && st.hwcTempDesired !== s.panel_hwc) patch.panel_hwc = st.hwcTempDesired;
      if (Object.keys(patch).length) await this.setSettings(patch).catch(this.error);
    }
  }

  async _save() {
    for (const [k, v] of Object.entries(this.targets)) await this.setStoreValue(k, v);
  }

  async _send(values) {
    await this.boiler.setMode(values);
    this.log('SetMode', JSON.stringify(values));
  }

  async _refresh() {
    if (!this.targets.control) return;
    try {
      await this._send({
        flowTemp: this.targets.flow,
        hwcTemp: this.targets.hwc,
        disableHc: !this.targets.heating,
      });
    } catch (err) {
      this.log('SetMode failed:', err.message);
    }
  }

  async setTarget(which, value) {
    this.targets[which] = value;
    this.targets.control = true;
    await this._save();
    await this._show();
    await this._refresh();
  }

  async setHeating(on) {
    this.targets.heating = on;
    this.targets.control = true;
    await this._save();
    await this._show();
    await this._refresh();
  }

  async setBusControl(on) {
    this.targets.control = on;
    await this._save();
    await this._show();
    if (on) {
      await this._refresh();
    } else {
      // hand the boiler back to its own panel
      const s = this.getSettings();
      if (s.panel_flow >= 20) {
        await this._send({ flowTemp: s.panel_flow, hwcTemp: s.panel_hwc >= 30 ? s.panel_hwc : this.targets.hwc });
      }
    }
    this.homey.setTimeout(() => this.poll(), 3000);
  }

  async onSettings({ changedKeys }) {
    if (changedKeys.some((k) => ['transport', 'host', 'port', 'address'].includes(k))) {
      this.homey.setTimeout(() => this._connect(), 500);
    } else if (changedKeys.some((k) => k.endsWith('_interval'))) {
      this.homey.setTimeout(() => this._schedule(), 500);
    }
  }

  async onDeleted() {
    this.onUninit();
  }

  async onUninit() {
    this.homey.clearInterval(this.pollTimer);
    this.homey.clearInterval(this.controlTimer);
    if (this.boiler) this.boiler.close();
  }
}

module.exports = BoilerDevice;
