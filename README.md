# Vaillant eBUS for Homey Pro

Local monitoring and control of Vaillant boilers (BAI burner control: ecoTEC, turboTEC, atmoTEC …) over eBUS — no cloud.

Tested with **Vaillant BAI00, SW 0403 / HW 0903** (no room controller on the bus).

## What it does

| Capability | Source |
|---|---|
| Flow / return / hot-water temperature | d.40, d.41, d.03 |
| Water pressure (bar) | `b509 0d0200` |
| Flame, modulation, hot-water demand | `b509` registers |
| Current faults (F.xx) + alarm | `b503 0001` |
| **Heating flow setpoint** (writable) | `b510 00` SetMode, as a VRC controller sends it |
| **Hot-water setpoint** (writable) | `b510 00` SetMode |
| Heating on/off (writable) | SetMode disable bit |
| *Controlled by Homey* toggle | on: setpoint refreshed every 60 s; off: panel values sent back |

Flow cards: flame on/off, error changed, pressure changed; conditions flame is on, pressure below; actions set flow / hot-water setpoint, control on/off.

### Notes from the real boiler

* The boiler display keeps showing the **panel** setpoint. The value actually used is diagnostics **d.05** — that is what this app sets and reads.
* The bus setpoint is **not** limited by the panel value (45 °C was accepted with the panel at 39 °C).
* The boiler keeps the last bus setpoint for a long time without refresh (> 8 min observed). Turning *Controlled by Homey* off therefore sends the learned panel values back.

## Hardware

Homey cannot use USB devices, so the bus has to be reachable over the network:

1. **ebusd** on a Raspberry Pi / PC with a USB eBUS adapter — start it with `--enablehex`:
   `ebusd -d /dev/ttyUSB0 --port=8888 --enablehex --scanconfig`
2. **Adapter with enhanced protocol over TCP** (ebusd.eu v5 / v5-C6, port 9999, or an ESP firmware implementing it) — the app talks to it directly, no ebusd needed. *Not yet tested on hardware.*

## Development

```
npm test                                     # offline protocol tests (captured telegrams)
node tools/probe.js ebusd 127.0.0.1 8888     # read the boiler without Homey
node tools/probe.js ebusd 127.0.0.1 8888 --set 40 46   # send SetMode once
homey app run                                # run on your Homey Pro
```

Message definitions are taken from [ebusd-configuration](https://github.com/john30/ebusd-configuration) (`vaillant/08.bai.csv`).

## License

MIT © vova275
