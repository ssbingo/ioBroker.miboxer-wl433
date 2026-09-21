# ioBroker.miboxer-wl433

> [English README](../../README.md)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

Lokale bediening van de **MiBoxer PW01 / PW02** LoRa-zwembadlampen (433 MHz) via de **MiBoxer WL-433**-gateway — zonder cloud, zonder spraakassistent, direct in je eigen netwerk.

Fabrikant: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — [WL-433](https://miboxer.com/product/lora-433mhz-gateway), [PW01](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz)

## Disclaimer

Dit is een **onofficieel communityproject**. Het is **op geen enkele manier verbonden** met Shenzhen Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) of Tuya en wordt door hen niet ondersteund. „MiBoxer“, „Mi-Light“ en „Tuya“ zijn handelsmerken van hun respectieve eigenaren en worden alleen gebruikt om de compatibiliteit te beschrijven. Gebruik op eigen risico.

## Werking

In de WL-433 zit een Tuya-wifimodule. In het lokale netwerk is de gateway **één** Tuya-apparaat — alle gekoppelde lampen worden via dit apparaat bediend, de gateway stuurt de commando's via LoRa (433 MHz) naar de lampen. De adapter spreekt het **Tuya-LAN-protocol 3.3** (TCP-poort 6668, AES-versleuteld met de lokale sleutel) rechtstreeks met de gateway, op basis van de beproefde bibliotheek [tuyapi](https://github.com/codetheweb/tuyapi) (ook gebruikt door ioBroker.tuya). Protocolversies 3.1, 3.4 en 3.5 worden ook ondersteund, voor het geval een firmware-update die wijzigt.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

Het achterliggende onderzoek (protocolanalyse, bronnen, testplan) is in het Duits beschikbaar: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Handleiding voor het koppelen van de lampen aan de gateway: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Ondersteunde hardware

| Apparaat | Rol | Status |
| --- | --- | --- |
| MiBoxer WL-433 | Vereist, de adapter maakt er verbinding mee | Tuya-protocol 3.3 bevestigd door een gebruiker met identieke hardware |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lamp, gekoppeld aan de gateway | Doelapparaat |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lamp, gekoppeld aan de gateway | Zelfde productfamilie, zou moeten werken |
| MiBoxer UW01, UW02, UW03, RD-9L | Lamp, gekoppeld aan de gateway | Niet getest |

## Vereisten

1. De gateway is ingesteld in de MiBoxer-app en de lampen zijn eraan gekoppeld.
2. **Apparaat-ID en lokale sleutel** van de gateway. De fabrikant ondersteunt het Tuya-ontwikkelaarsplatform niet voor de WL-433, maar de MiBoxer-app schrijft beide waarden naar zijn debuglogboek: lees op Android het logboek met een logcat-viewer zoals *LogFox* terwijl de app start en de gateway bedient. **De lokale sleutel verandert telkens wanneer de gateway opnieuw wordt gekoppeld** — dan moet hij opnieuw worden uitgelezen en ingevoerd.
3. De gateway is bereikbaar vanuit ioBroker (hetzelfde netwerk). Een DHCP-reservering wordt aanbevolen; zonder ingesteld IP-adres vindt de adapter de gateway via zijn UDP-broadcasts (poorten 6666/6667).
4. **Tuya-apparaten accepteren slechts één lokale verbinding.** Sluit de MiBoxer-app op telefoons in hetzelfde netwerk en bedien de gateway niet tegelijk met andere lokale integraties (ioBroker.tuya, Home Assistant, tinytuya).

## Configuratie

| Instelling | Beschrijving |
| --- | --- |
| Apparaat-ID | Tuya-apparaat-ID van de WL-433-gateway |
| Lokale sleutel | Tuya-lokale sleutel van 16 tekens (versleuteld opgeslagen) |
| IP-adres van de gateway | Leeg laten om de gateway automatisch in het lokale netwerk te vinden |
| Tuya-protocolversie | 3.3 voor de WL-433 (3.1, 3.4 en 3.5 selecteerbaar) |
| Gateway zoeken in het lokale netwerk | Knop: vindt de gateway aan de hand van de apparaat-ID en vult IP-adres en protocolversie in. Zonder apparaat-ID worden alle gevonden Tuya-apparaten weergegeven |
| Vertraging voor opnieuw verbinden | Seconden tot een nieuwe verbindingspoging (standaard 30) |
| Interval voor statusvernieuwing | Seconden tussen volledige statusopvragingen (standaard 60, 0 = alleen door de gateway verstuurde updates) |

## Datapunten

| State | Tuya DP | Beschrijving |
| --- | --- | --- |
| `info.connection` | – | Verbinding met de gateway |
| `info.ip` | – | Gebruikt IP-adres van de gateway |
| `light.on` | 20 | Alle lampen aan/uit |
| `light.mode` | 21 | `white`, `colour`, `scene`, `music` |
| `light.brightness` | 22 / 24 | Helderheid 0–100 %. In kleurmodus wordt de helderheid van de kleur (DP 24) gewijzigd, anders de witte helderheid (DP 22). 0 schakelt uit, een waarde boven 0 schakelt in |
| `light.colorTemperature` | 23 | Kleurtemperatuur 2700–6500 K (schakelt naar de witmodus) |
| `light.color` | 24 | Kleur als `#rrggbb` (schakelt naar de kleurmodus) |
| `light.countdown` | 26 | Seconden tot de gateway de lampen omschakelt (0 = uit) |
| `dp101.raw` | 101 | Laatste DP-101-frame als Base64 — schrijven verstuurt de waarde ongewijzigd |
| `dp101.hex` | 101 | Laatste DP-101-frame als hexbytes — schrijven verstuurt het frame, de controlesom wordt automatisch toegevoegd of gecorrigeerd |
| `dp101.checksumValid` | 101 | Controlesom van het laatste frame is geldig |
| `dp101.history` | 101 | JSON-lijst van de laatste 50 frames (`rx` = ontvangen, `tx` = verzonden) met tijdstempel |
| `raw.dp<n>` | n | Elk verder door de gateway gemeld datapunt wordt automatisch aangemaakt (beschrijfbaar) |

Snelle wijzigingen (bijv. van een schuifregelaar) worden samengevoegd tot één commando. Commando's worden alleen geaccepteerd zolang de gateway verbonden is.

## Datapunt 101 — zones en scènes

De WL-433 verstuurt zone- en scènecommando's in het fabrikantspecifieke datapunt 101: binaire frames van 12 bytes, Base64-gecodeerd, waarbij het laatste byte de 8-bits som van bytes 0–10 is. De betekenis van de overige bytes is **nog niet gedecodeerd**. Tot die tijd biedt de adapter directe toegang:

- ontvangen frames verschijnen in `dp101.raw` / `dp101.hex` en worden vastgelegd in `dp101.history`,
- frames kunnen via `dp101.hex` worden verzonden — 11 bytes volstaan, de controlesom wordt automatisch toegevoegd, bijv. `43 00 00 80 00 00 00 00 00 80 80`

**Hulp gezocht:** voer in de MiBoxer-app telkens precies één actie uit (per zone: aan, uit, kleur, scène 1–9) en noteer de frames uit `dp101.history`. Met genoeg opnames kunnen de frames worden gedecodeerd en eigen zone- en scènedatapunten worden toegevoegd. De werkwijze staat in hoofdstuk 6 van de protocolanalyse.

## Beperkingen

- De standaarddatapunten 20–26 werken op alle lampen van de gateway (mogelijk alleen op de in de app geselecteerde zone). Aparte zones en scènes volgen zodra datapunt 101 is gedecodeerd.
- De gateway meldt zijn status nog steeds aan de Tuya-cloud. Het volledig blokkeren van internettoegang kan hem onbetrouwbaar maken.
- Deze eerste versie is getest met een simulatie van de gateway (Tuya-protocol 3.3). Feedback met echte hardware is zeer welkom.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) Eerste versie: lokale bediening van de WL-433-gateway via het Tuya-LAN-protocol (aan/uit, modus, helderheid, kleurtemperatuur, kleur, aftellen), directe toegang tot datapunt 101 met controlesomafhandeling en zoeken naar de gateway in het lokale netwerk

## Licentie

MIT-licentie — Copyright (c) 2026 ssbingo. De volledige licentietekst staat in de [English README](../../README.md#license) en in het bestand [LICENSE](../../LICENSE).
