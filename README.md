# Automation kit

The automation kit is a platform that enables hands free, automated interaction with electronic hardware. It is a package of hardware and software with a simple interface.

## Architecture

The goal is to have a "standard" package that can be used in a range of automation use cases, for example automated testing. There are many ways one could create a device that fits with their specific scenario - however the automation kit should provide a "one-box" solution that can be shipped and deployed, with confidence that it will provide some clearly defined capabilities, with a clearly defined interface. Those without the hardware or software knowledge, or time to develop their own automation tool can simply use this one. 

Another goal is to manage the automation kit as a platform - users should be providing feedback, and community contribution should be enabled and encouraged. This is the only way to scale the platform, and let it become the "general" solution for automated interaction with hardware.

Based on these goals, the architecture should keep the following mantras in mind:

- use hardware that is openly available, or open source
- have a single common, widely used interface
- features should be decoupled from eachother where possible
- we want standardisation of the hardware - but at the same time, hardware should be easily replaced or substituted

![block-diagram](documentation/images/arch.jpg?raw=true)

### Hardware

The hardware of the autmotion kit is a USB hub, and a collection of USB devices. A host or controller device can act as the host for the hub, and the USB devices connect to the hub, and implement the "actions" that one would want to automate with the kit.

The suite of hardware currently envisioned:
- USB hub (Any use hub)
- [SD card multiplexer](https://github.com/balena-io-hardware/autokit-sd-mux) 
- [Mains relay controller](https://github.com/balena-io-hardware/autokit-relay)
- [USB HDMI capture device](https://www.amazon.co.uk/dp/B093D6824V/ref=sspa_dk_detail_3?psc=1&pd_rd_i=B093D6824V&pd_rd_w=MhHqo&content-id=amzn1.sym.1d17a7d9-68f2-46c6-a55b-f888c57f8c2e&pf_rd_p=1d17a7d9-68f2-46c6-a55b-f888c57f8c2e&pf_rd_r=3KSV1G8M649W5X9N7X52&pd_rd_wg=pxzYg&pd_rd_r=4254f3c1-ea0e-4e47-aebf-22eccee1f69d&s=electronics&sp_csd=d2lkZ2V0TmFtZT1zcF9kZXRhaWw&spLa=ZW5jcnlwdGVkUXVhbGlmaWVyPUEySEsyQUxEVUVWR1Q2JmVuY3J5cHRlZElkPUEwNTgyNzc4MkVaTUZITDBEVkdBSSZlbmNyeXB0ZWRBZElkPUEwMzA5NzQ1MlZYMkVCWEM3RTRXVCZ3aWRnZXROYW1lPXNwX2RldGFpbCZhY3Rpb249Y2xpY2tSZWRpcmVjdCZkb05vdExvZ0NsaWNrPXRydWU=)
- [USB to ethernet adapter](https://www.amazon.co.uk/AmazonBasics-1000-Gigabit-Ethernet-Adapter/dp/B00M77HMU0)
- [USB microphone adapter](https://www.amazon.co.uk/gp/product/B00IRVQ0F8/ref=ppx_yo_dt_b_asin_title_o06_s00?ie=UTF8&psc=1)
- [USB UART adapter](https://ftdichip.com/products/ttl-232r-3v3/)


#### Why USB?

USB is a standard interface, and there are many sensor and actuator devices now that use USB. Using USB lets any device act as the host for the automation kit - a laptop, a raspberry pi, a NUC, an etcherPro....

There may be devices that are "better" for a specific use case than a USB equivalent - for example perhaps a CSI camera provides higher bandwidth than a USB one. However not all host devices may hae a CSI port. Making exceptions for interfaces like this is a slippery slope, and the danger is that we're left with a big collection of different interfaces, instead of one universal one. 

### Enclosure and assembly

[Assembly guide and BoM](https://github.com/balena-io-hardware/autokit-assembly)

### Software

[Autokit software interface](https://github.com/balena-io-hardware/autokit-sw)

## Capabilities

The first set of capabilities of the kit are as follows. These are based off of the projects initial purpose, which was a tool to automation the provisioning and testing of embedded linux SBC's.

- Multiplexing an SD card between the automation kit host, and the device under test (DUT)
- Controlling the power to a DUT
- Providing an ethernet connection to the DUT
- Providing a wifi connection to the DUT
- Capturing HDMI output from the DUT
- Capturing sound output from the DUT
- Capturing serial output from the DUT

## Interface

- USB
- Docker container

## Contributing

1. Identify a feature or capability that you desire- e.g voltmeter
2. Find a USB device that has that functionality - or design it!
3. Add that device to the [supported devices list](https://github.com/balena-io-hardware/autokit-assembly)
4. Add the software interface following the instructions [here](https://github.com/balena-io-hardware/autokit-sw)
5. Update the capabilities list above



###TEST PR