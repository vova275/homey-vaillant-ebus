Bring your Vaillant gas boiler into Homey and keep an eye on it from anywhere in your home. See at a glance whether the burner is running, how warm the heating and hot water are, whether the water pressure is fine, and get notified the moment the boiler reports a fault. Everything stays local: the app talks to the boiler over its own eBUS, just like a Vaillant room controller, without any cloud.

When you want more than a view, let Homey take over as the boiler's room controller. Homey then sets the heating to suit the weather outside and the temperature in your rooms, switches between comfort, eco and away whenever your Flows say so, and only heats when your zone valves ask for it.

Hardware

Homey reaches the boiler through an eBUS adapter, connected to the boiler's eBUS terminals (2 wires, polarity does not matter). Two ways to connect it:

1. Wi-Fi or Ethernet, no extra computer: an ebusd.eu adapter (v5, Shield C5, Shield C6, Stick C6) with current firmware, in its free "enhanced" mode on port 9999. The paid micro-ebusd token is not needed.
2. USB: the same ebusd.eu adapters connected by USB, or any other ebusd-compatible USB eBUS adapter, plugged into a Raspberry Pi or an always-on computer running ebusd (started with --enablehex, port 8888). Homey itself cannot use USB devices.

Works with Vaillant boilers with BAI burner control (ecoTEC, turboTEC, atmoTEC and similar); tested with a BAI00. Do not let Homey control the boiler while a Vaillant VRC room controller is connected to it as well.
