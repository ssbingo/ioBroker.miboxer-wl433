![Logo](admin/miboxer-wl433.png)
# ioBroker.miboxer-wl433

[![NPM version](https://img.shields.io/npm/v/iobroker.miboxer-wl433.svg)](https://www.npmjs.com/package/iobroker.miboxer-wl433)
[![Downloads](https://img.shields.io/npm/dm/iobroker.miboxer-wl433.svg)](https://www.npmjs.com/package/iobroker.miboxer-wl433)
![Number of Installations](https://iobroker.live/badges/miboxer-wl433-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/miboxer-wl433-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.miboxer-wl433.png?downloads=true)](https://nodei.co/npm/iobroker.miboxer-wl433/)

**Tests:** ![Test and Release](https://github.com/ssbingo/ioBroker.miboxer-wl433/workflows/Test%20and%20Release/badge.svg)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

## MiBoxer WL-433 pool light adapter for ioBroker

Local control of **MiBoxer PW01 / PW02** LoRa pool lights (433 MHz) via the **MiBoxer WL-433** gateway — without
cloud, without voice assistant, directly in your local network.

Manufacturer: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — product pages:
[WL-433 gateway](https://miboxer.com/product/lora-433mhz-gateway),
[PW01 pool light](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz),
[FUT086 remote](https://miboxer.com/product/8-zone-lora-433mhz-remote-control)

### Disclaimer

This is an **unofficial community project**. It is **not affiliated with, endorsed by, or supported by** Shenzhen
Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) or Tuya. "MiBoxer", "Mi-Light" and "Tuya" are trademarks of
their respective owners and are only used to describe device compatibility. Use this adapter at your own risk.

### How it works

The WL-433 gateway contains a Tuya WiFi module. For the local network it is **one** Tuya device — all lamps linked to
it are controlled through this single device, the gateway forwards the commands via LoRa (433 MHz) to the lamps.
The adapter talks the **Tuya LAN protocol 3.3** (TCP port 6668, AES encrypted with the device's local key) directly
with the gateway, based on the proven [tuyapi](https://github.com/codetheweb/tuyapi) library (also used by
ioBroker.tuya). Protocol versions 3.1, 3.4 and 3.5 are supported as well, in case a firmware update changes it.

```text
ioBroker (this adapter) ──LAN: Tuya protocol 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

The background research (protocol analysis, sources, test plan) is available in German:
[doc/Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](doc/Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md)
([PDF](doc/Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). A beginner's guide for linking the lamps to the
gateway: [doc/Anleitung_PW01_mit_WL-433_verbinden.pdf](doc/Anleitung_PW01_mit_WL-433_verbinden.pdf).

### Supported hardware

| Device | Role | Status |
| --- | --- | --- |
| MiBoxer WL-433 LoRa 433 MHz gateway | Required, the adapter connects to it | Tuya protocol 3.3 confirmed by a user with identical hardware |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Pool light, linked to the gateway | Target device |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Pool light, linked to the gateway | Same product family, expected to work |
| Other MiBoxer LoRa 433 MHz lamps (UW01, UW02, UW03, RD-9L) | Lamps linked to the gateway | Untested |

### Prerequisites

1. The gateway is set up in the MiBoxer app and the lamps are linked to it.
2. **Device ID and local key** of the gateway. The manufacturer does not support the Tuya developer platform for the
   WL-433, but the MiBoxer app writes both values to its debug log: on Android, read the log with a logcat viewer such
   as *LogFox* while the app starts and controls the gateway. **The local key changes whenever the gateway is paired
   again** — then it has to be read and entered again. A beginner's step-by-step guide (German, for Android, iPhone
   and iPad): [doc/Anleitung_Geraete-ID_und_Local-Key_auslesen.md](doc/Anleitung_Geraete-ID_und_Local-Key_auslesen.md)
   ([PDF](doc/Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. The gateway is reachable from ioBroker (same network). A DHCP reservation for the gateway is recommended; if no IP
   address is configured, the adapter finds the gateway via its UDP broadcasts (ports 6666/6667).
4. **Tuya devices accept only one local connection.** Close the MiBoxer app on phones in the same network and do not
   control the gateway with other local integrations (ioBroker.tuya, Home Assistant, tinytuya) at the same time.

### Configuration

| Setting | Description |
| --- | --- |
| Device ID | Tuya device ID of the WL-433 gateway |
| Local key | 16-character Tuya local key (stored encrypted) |
| IP address of the gateway | Leave empty to find the gateway automatically in the local network |
| Tuya protocol version | 3.3 for the WL-433 (3.1, 3.4 and 3.5 are selectable) |
| Search gateway in the local network | Button: finds the gateway by its device ID and fills in IP address and protocol version. Without device ID it lists all Tuya devices found |
| Reconnect delay | Seconds until a lost or failed connection is retried (default 30) |
| Status refresh interval | Seconds between full status requests (default 60, 0 = only use the updates pushed by the gateway) |

### States

| State | Tuya DP | Description |
| --- | --- | --- |
| `info.connection` | – | Connection to the gateway |
| `info.ip` | – | IP address used for the gateway |
| `light.on` | 20 | Switch all lamps on/off |
| `light.mode` | 21 | `white`, `colour`, `scene` or `music` |
| `light.brightness` | 22 / 24 | Brightness 0–100 %. In colour mode the brightness of the colour (DP 24) is changed, otherwise the white brightness (DP 22). 0 switches off, a value above 0 switches on |
| `light.colorTemperature` | 23 | Colour temperature 2700–6500 K (switches to white mode) |
| `light.color` | 24 | Colour as `#rrggbb` (switches to colour mode) |
| `light.countdown` | 26 | Seconds until the gateway toggles the lamps (0 = off) |
| `dp101.raw` | 101 | Last DP 101 frame as Base64 — writing sends the value unchanged |
| `dp101.hex` | 101 | Last DP 101 frame as hex bytes — writing sends the frame, the checksum is added or corrected automatically |
| `dp101.checksumValid` | 101 | Checksum of the last frame is valid |
| `dp101.history` | 101 | JSON list of the last 50 frames (`rx` = received, `tx` = sent) with time stamp |
| `raw.dp<n>` | n | Every further datapoint the gateway reports is created automatically (writable) |

Rapid changes (e.g. from a slider) are combined into one command. Commands are only accepted while the gateway is
connected.

### Datapoint 101 — zones and scenes

The WL-433 transports its zone and scene commands in the vendor specific datapoint 101: 12-byte binary frames,
Base64 encoded, the last byte is the 8-bit sum of bytes 0–10. The meaning of the other bytes is **not decoded yet**.
Until then the adapter offers raw access:

- received frames are shown in `dp101.raw` / `dp101.hex` and logged in `dp101.history`,
- frames can be sent via `dp101.hex` — 11 bytes are enough, the checksum is appended automatically,
  e.g. `43 00 00 80 00 00 00 00 00 80 80`.

**Help wanted:** record one action at a time in the MiBoxer app (per zone: on, off, colour, scene 1–9) and note the
frames from `dp101.history`. With enough recordings the frames can be decoded and dedicated zone and scene states
added. The procedure is described in chapter 6 of the protocol analysis.

### Limitations

- The standard datapoints 20–26 act on all lamps of the gateway (possibly only on the zone selected in the app).
  Separate zones and scenes will follow once datapoint 101 is decoded.
- The gateway still reports its status to the Tuya cloud. Blocking its internet access completely may make it
  unreliable.
- This first version was tested against a simulation of the gateway (Tuya protocol 3.3). Feedback with real hardware
  is very welcome.

## Development

`npm run build` compiles the TypeScript sources, `npm test` runs the unit and package tests. `npm run test:e2e` runs
the adapter in a temporary ioBroker installation against a simulated WL-433 (Tuya protocol 3.3 on `127.0.0.1:6668`,
UDP broadcasts on port 6667) — these ports must be free.

Local test system with [dev-server](https://github.com/ioBroker/dev-server) (admin on port 8091):

```bash
npx dev-server setup --adminPort 8091 --symlinks   # once, creates .dev-server/
npm run simulator                                   # optional: simulated WL-433 in a second terminal
npm run dev-server watch                            # starts ioBroker + adapter, restarts on code changes
```

Admin: `http://<IP of the development machine>:8091` (the dev-server listens on all interfaces, locally
<http://127.0.0.1:8091>). Without real hardware, configure the instance with the values printed by
`npm run simulator` (device ID, local key, IP `127.0.0.1`). `npm run dev-server debug` starts the adapter with an
inspector for the VS Code debugger.

## Documentation

Translated documentation:

- 🇩🇪 [Deutsche Dokumentation](doc/de/README.md)
- 🇷🇺 [Документация на русском](doc/ru/README.md)
- 🇳🇱 [Nederlandse documentatie](doc/nl/README.md)
- 🇫🇷 [Documentation française](doc/fr/README.md)
- 🇮🇹 [Documentazione italiana](doc/it/README.md)
- 🇪🇸 [Documentación en español](doc/es/README.md)
- 🇵🇱 [Dokumentacja polska](doc/pl/README.md)
- 🇵🇹 [Documentação portuguesa](doc/pt/README.md)
- 🇺🇦 [Документація українською](doc/uk/README.md)
- 🇨🇳 [简体中文文档](doc/zh-cn/README.md)

Credits: the checksum of datapoint 101 and the first published frames come from the tinytuya discussion
[#623](https://github.com/jasonacox/tinytuya/discussions/623) (users *Silverstar* and *uzlonewolf*).

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) Initial release: local control of the WL-433 gateway via the Tuya LAN protocol (on/off, mode, brightness, colour temperature, colour, countdown), raw access to datapoint 101 with checksum handling and gateway search in the local network

## License

MIT License

Copyright (c) 2026 ssbingo <s.sternitzke@online.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
