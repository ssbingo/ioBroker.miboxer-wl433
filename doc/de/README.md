# ioBroker.miboxer-wl433

> [English README](../../README.md)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

Lokale Steuerung der **MiBoxer PW01 / PW02** LoRa-Poolleuchten (433 MHz) über das **MiBoxer WL-433**-Gateway – ohne Cloud, ohne Sprachassistent, direkt im eigenen Netzwerk.

Hersteller: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — [WL-433](https://miboxer.com/product/lora-433mhz-gateway), [PW01](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz)

## Haftungsausschluss

Dies ist ein **inoffizielles Community-Projekt**. Es steht in **keinerlei Verbindung** zur Shenzhen Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) oder zu Tuya und wird von diesen weder unterstützt noch befürwortet. „MiBoxer“, „Mi-Light“ und „Tuya“ sind Marken ihrer jeweiligen Inhaber und werden nur zur Beschreibung der Gerätekompatibilität verwendet. Die Nutzung erfolgt auf eigene Gefahr.

## Funktionsweise

Im WL-433 steckt ein Tuya-WLAN-Modul. Im lokalen Netzwerk ist das Gateway **ein** Tuya-Gerät – alle verknüpften Leuchten werden über dieses eine Gerät gesteuert, das Gateway funkt die Befehle per LoRa (433 MHz) an die Leuchten. Der Adapter spricht das **Tuya-LAN-Protokoll 3.3** (TCP-Port 6668, AES-verschlüsselt mit dem Local Key) direkt mit dem Gateway, auf Basis der bewährten Bibliothek [tuyapi](https://github.com/codetheweb/tuyapi) (auch von ioBroker.tuya genutzt). Die Protokollversionen 3.1, 3.4 und 3.5 werden ebenfalls unterstützt, falls ein Firmware-Update sie ändert.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

Die zugrunde liegende Recherche (Protokollanalyse, Quellen, Prüfplan): [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Einsteigeranleitung zum Verknüpfen der Leuchten mit dem Gateway: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Unterstützte Hardware

| Gerät | Rolle | Status |
| --- | --- | --- |
| MiBoxer WL-433 | Erforderlich, der Adapter verbindet sich damit | Tuya-Protokoll 3.3 von einem Anwender mit identischer Hardware bestätigt |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Leuchte, mit dem Gateway verknüpft | Zielgerät |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Leuchte, mit dem Gateway verknüpft | Gleiche Produktfamilie, sollte funktionieren |
| MiBoxer UW01, UW02, UW03, RD-9L | Leuchte, mit dem Gateway verknüpft | Ungetestet |

## Voraussetzungen

1. Das Gateway ist in der MiBoxer-App eingerichtet und die Leuchten sind damit verknüpft.
2. **Geräte-ID und Local Key** des Gateways. Der Hersteller unterstützt die Tuya-Entwicklerplattform für das WL-433 nicht, die MiBoxer-App schreibt beide Werte aber in ihr Debug-Log: unter Android das Log mit einem Logcat-Viewer wie *LogFox* mitlesen, während die App startet und das Gateway steuert. **Der Local Key ändert sich bei jedem erneuten Koppeln des Gateways** – dann muss er neu ausgelesen und eingetragen werden. Eine Schritt-für-Schritt-Anleitung für Einsteiger (Android, iPhone und iPad): [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](../Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](../Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. Das Gateway ist von ioBroker aus erreichbar (gleiches Netzwerk). Eine DHCP-Reservierung wird empfohlen; ohne eingetragene IP-Adresse findet der Adapter das Gateway über dessen UDP-Broadcasts (Ports 6666/6667).
4. **Tuya-Geräte akzeptieren nur eine lokale Verbindung.** Schließe die MiBoxer-App auf Smartphones im selben Netzwerk und steuere das Gateway nicht gleichzeitig mit anderen lokalen Integrationen (ioBroker.tuya, Home Assistant, tinytuya).

## Konfiguration

| Einstellung | Beschreibung |
| --- | --- |
| Geräte-ID | Tuya-Geräte-ID des WL-433-Gateways |
| Local Key | 16-stelliger Tuya-Local-Key (verschlüsselt gespeichert) |
| IP-Adresse des Gateways | Leer lassen, um das Gateway automatisch im lokalen Netzwerk zu finden |
| Tuya-Protokollversion | 3.3 für das WL-433 (3.1, 3.4 und 3.5 wählbar) |
| Gateway im lokalen Netzwerk suchen | Schaltfläche: findet das Gateway anhand der Geräte-ID und trägt IP-Adresse und Protokollversion ein. Ohne Geräte-ID werden alle gefundenen Tuya-Geräte aufgelistet |
| Wartezeit bis zum Neuverbinden | Sekunden bis zum erneuten Verbindungsversuch (Standard 30) |
| Intervall für die Statusabfrage | Sekunden zwischen vollständigen Statusabfragen (Standard 60, 0 = nur vom Gateway gesendete Aktualisierungen) |

## Datenpunkte

| State | Tuya DP | Beschreibung |
| --- | --- | --- |
| `info.connection` | – | Verbindung zum Gateway |
| `info.ip` | – | Verwendete IP-Adresse des Gateways |
| `light.on` | 20 | Alle Leuchten ein/aus |
| `light.mode` | 21 | `white`, `colour`, `scene`, `music` |
| `light.brightness` | 22 / 24 | Helligkeit 0–100 %. Im Farbmodus wird die Helligkeit der Farbe (DP 24) geändert, sonst die Weiß-Helligkeit (DP 22). 0 schaltet aus, ein Wert über 0 schaltet ein |
| `light.colorTemperature` | 23 | Farbtemperatur 2700–6500 K (schaltet in den Weißmodus) |
| `light.color` | 24 | Farbe als `#rrggbb` (schaltet in den Farbmodus) |
| `light.countdown` | 26 | Sekunden, bis das Gateway die Leuchten umschaltet (0 = aus) |
| `dp101.raw` | 101 | Letzter DP-101-Frame als Base64 – Schreiben sendet den Wert unverändert |
| `dp101.hex` | 101 | Letzter DP-101-Frame als Hex-Bytes – Schreiben sendet den Frame, die Prüfsumme wird automatisch ergänzt oder korrigiert |
| `dp101.checksumValid` | 101 | Prüfsumme des letzten Frames ist gültig |
| `dp101.history` | 101 | JSON-Liste der letzten 50 Frames (`rx` = empfangen, `tx` = gesendet) mit Zeitstempel |
| `raw.dp<n>` | n | Jeder weitere vom Gateway gemeldete Datenpunkt wird automatisch angelegt (schreibbar) |

Schnelle Änderungen (z. B. von einem Schieberegler) werden zu einem Befehl zusammengefasst. Befehle werden nur angenommen, solange das Gateway verbunden ist.

## Datenpunkt 101 – Zonen und Szenen

Das WL-433 überträgt Zonen- und Szenenbefehle im herstellerspezifischen Datenpunkt 101: 12-Byte-Binärframes, Base64-kodiert, das letzte Byte ist die 8-Bit-Summe der Bytes 0–10. Die Bedeutung der übrigen Bytes ist **noch nicht dekodiert**. Bis dahin bietet der Adapter Rohzugriff:

- empfangene Frames erscheinen in `dp101.raw` / `dp101.hex` und werden in `dp101.history` protokolliert,
- Frames lassen sich über `dp101.hex` senden – 11 Bytes genügen, die Prüfsumme wird automatisch angehängt, z. B. `43 00 00 80 00 00 00 00 00 80 80`

**Mithilfe erwünscht:** in der MiBoxer-App jeweils genau eine Aktion ausführen (je Zone: ein, aus, Farbe, Szene 1–9) und die Frames aus `dp101.history` notieren. Mit genügend Mitschnitten lassen sich die Frames dekodieren und eigene Zonen- und Szenen-Datenpunkte ergänzen. Das Vorgehen beschreibt Kapitel 6 der Protokollanalyse.

## Einschränkungen

- Die Standard-Datenpunkte 20–26 wirken auf alle Leuchten des Gateways (möglicherweise nur auf die in der App gewählte Zone). Getrennte Zonen und Szenen folgen, sobald Datenpunkt 101 dekodiert ist.
- Das Gateway meldet seinen Status weiterhin an die Tuya-Cloud. Eine vollständige Internetsperre kann es unzuverlässig machen.
- Diese erste Version wurde gegen eine Simulation des Gateways (Tuya-Protokoll 3.3) getestet. Rückmeldungen mit echter Hardware sind sehr willkommen.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) Erste Version: lokale Steuerung des WL-433-Gateways über das Tuya-LAN-Protokoll (Ein/Aus, Modus, Helligkeit, Farbtemperatur, Farbe, Countdown), Rohzugriff auf Datenpunkt 101 mit Prüfsummenbehandlung und Gateway-Suche im lokalen Netzwerk

## Lizenz

MIT-Lizenz – Copyright (c) 2026 ssbingo. Der vollständige Lizenztext steht im [English README](../../README.md#license) und in der Datei [LICENSE](../../LICENSE).
