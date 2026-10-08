'use strict';

const Homey = require('homey');
const Sensors = require('./lib/sensors');

class VaillantEbusApp extends Homey.App {
  async onInit() {
    this.sensors = new Sensors(this.homey, (...a) => this.log(...a));
    this.log('Vaillant eBUS app started');
  }
}

module.exports = VaillantEbusApp;
