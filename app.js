'use strict';

const Homey = require('homey');
const { Weather } = require('./lib/weather');

class VaillantEbusApp extends Homey.App {
  async onInit() {
    this.weather = new Weather(this.homey, (...a) => this.log(...a));
    this.log('Vaillant eBUS app started');
  }
}

module.exports = VaillantEbusApp;
