'use strict';

const Homey = require('homey');

class VaillantEbusApp extends Homey.App {
  async onInit() {
    this.log('Vaillant eBUS app started');
  }
}

module.exports = VaillantEbusApp;
