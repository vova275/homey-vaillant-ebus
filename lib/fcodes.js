'use strict';

// Common Vaillant ecoTEC / turboTEC fault codes (installation manuals).
const F = {
  0: 'Flow temperature sensor interrupted',
  1: 'Return temperature sensor interrupted',
  2: 'Hot water outlet sensor interrupted',
  3: 'Storage sensor interrupted',
  10: 'Flow temperature sensor short circuit',
  11: 'Return temperature sensor short circuit',
  13: 'Storage sensor short circuit',
  20: 'Safety temperature limiter tripped',
  22: 'Dry fire: too little water in the boiler',
  23: 'Water shortage: flow/return difference too large',
  24: 'Water shortage: temperature rising too fast',
  25: 'Flue gas temperature too high',
  26: 'Gas valve fault',
  27: 'Flame detected with gas valve closed',
  28: 'No ignition at start-up',
  29: 'Flame lost during operation',
  32: 'Fan speed fault',
  33: 'Air pressure switch did not switch',
  37: 'Fan speed deviation during operation',
  42: 'Coding resistor fault',
  49: 'eBUS voltage too low',
  61: 'Gas valve control fault',
  62: 'Gas valve switch-off delay fault',
  63: 'EEPROM fault',
  64: 'Electronics or sensor fault',
  65: 'Electronics temperature too high',
  67: 'Flame signal implausible',
  70: 'Invalid device identification (DSN)',
  71: 'Flow sensor reports constant value',
  72: 'Flow / return sensor fault',
  73: 'Water pressure sensor signal too low',
  74: 'Water pressure sensor signal too high',
  75: 'No pressure change detected when the pump started',
  76: 'Primary heat exchanger overheat protection',
  77: 'Condensate pump or flue damper fault',
};

const code = (n) => `F.${String(n).padStart(2, '0')}`;
const describe = (n) => `${code(n)} ${F[n] || 'Unknown fault'}`;

module.exports = { code, describe };
