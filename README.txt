Control your Vaillant gas boiler from Homey — locally, over eBUS, without any cloud.

The app talks to the boiler's burner control (BAI: ecoTEC, turboTEC, atmoTEC and similar) the same way a Vaillant room controller does. It shows flow, return and hot-water temperatures, water pressure, flame, modulation and fault codes with descriptions, and it can set the heating and hot-water setpoints.

Turn on "Controlled by Homey" and Homey becomes the boiler's room controller:
- Modes: Comfort, Eco, Away (frost protection), Boost for a set time, Heating off.
- Weather-compensated heating curve using the weather for your Homey's location or any outdoor sensor.
- Room correction from the temperature sensors you choose.
- Zone valves: let the boiler follow the valve relays your own flows already switch, and keep the flow warm (or stop) when no zone needs heat.
- Low water pressure alarm, flame and fault triggers for notifications.
- Estimated heat output and gas consumption.

Hardware: Homey cannot use USB devices, so the eBUS must be reachable over the network:
1. ebusd on a Raspberry Pi or PC with any eBUS adapter, started with --enablehex (port 8888), or
2. an ebusd.eu Wi-Fi adapter (v5, Shield C5, Shield C6, Stick C6) using the enhanced protocol on port 9999 — no ebusd needed.

Tested with a Vaillant BAI00 (no Vaillant room controller on the bus). Do not run Homey control together with a Vaillant VRC controller on the same boiler.
