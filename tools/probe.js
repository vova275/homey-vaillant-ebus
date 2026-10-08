'use strict';

// Read the boiler from the command line, without Homey.
//   node tools/probe.js ebusd 127.0.0.1 [8888]
//   node tools/probe.js enhanced 192.168.1.50 [9999] [address-hex]
//   node tools/probe.js ebusd 127.0.0.1 8888 --set 35 46   (sends SetMode once)

const { Boiler } = require('../lib/boiler');

(async () => {
  const [transport = 'ebusd', host = '127.0.0.1', port, ...rest] = process.argv.slice(2);
  const setIdx = rest.indexOf('--set');
  const address = rest[0] && rest[0] !== '--set' ? parseInt(rest[0], 16) : 0x31;
  const b = new Boiler({
    transport, host, port: port && Number(port), address, log: (...a) => console.log('  log:', ...a),
  });
  try {
    console.log('ident:', await b.identify());
    if (setIdx >= 0) {
      const flowTemp = Number(rest[setIdx + 1]);
      const hwcTemp = Number(rest[setIdx + 2]);
      console.log('SetMode answer:', await b.setMode({ flowTemp, hwcTemp }));
    }
    const t0 = Date.now();
    console.log(await b.poll());
    console.log(`poll took ${Date.now() - t0} ms`);
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    b.close();
  }
})();
