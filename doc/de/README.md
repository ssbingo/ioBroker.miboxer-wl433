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

Leuchten, Zonen und Szenen werden mit den eigenen Befehlen des Gateways im herstellerspezifischen **Datenpunkt 101** gesteuert – denselben Befehlen, die auch die MiBoxer-App sendet. Das Gateway meldet seinen Status auf demselben Weg; der Adapter fragt ihn zusätzlich beim Verbinden und bei jeder Statusabfrage an.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

**Handbuch** mit jedem Schritt für Einsteiger erklärt (Installation, Einstellungen, Zonen, Timer, Beispiele, Fehlersuche): [Deutsch](../Handbuch_miboxer-wl433.md) ([PDF](../Handbuch_miboxer-wl433.pdf)) · [English](../Manual_miboxer-wl433.md) ([PDF](../Manual_miboxer-wl433.pdf)).

Die zugrunde liegende Recherche (Protokollanalyse, Quellen, Prüfplan, entschlüsselter Datenpunkt 101): [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Einsteigeranleitung zum Verknüpfen der Leuchten mit dem Gateway: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Unterstützte Hardware

| Gerät | Rolle | Status |
| --- | --- | --- |
| MiBoxer WL-433 | Erforderlich, der Adapter verbindet sich damit | Mit einem echten Gateway getestet (Tuya-Protokoll 3.3, Datenpunkt 101) |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Leuchte, mit dem Gateway verknüpft | Zielgerät |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Leuchte, mit dem Gateway verknüpft | Gleiche Produktfamilie, sollte funktionieren |
| MiBoxer UW01, UW02, UW03, RD-9L | Leuchte, mit dem Gateway verknüpft | Ungetestet |

## Voraussetzungen

1. Das Gateway ist in der MiBoxer-App eingerichtet und die Leuchten sind damit verknüpft.
2. **Geräte-ID und Local Key** des Gateways. Der Hersteller unterstützt die Tuya-Entwicklerplattform für das WL-433 nicht, die MiBoxer-App schreibt beide Werte aber in ihr Debug-Log: unter Android das Log mit einem Logcat-Viewer wie *LogFox* mitlesen, während die App startet und das Gateway steuert. **Der Local Key ändert sich bei jedem erneuten Koppeln des Gateways** – dann muss er neu ausgelesen und eingetragen werden. Eine Schritt-für-Schritt-Anleitung für Einsteiger (Android, iPhone und iPad): [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](../Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](../Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. Das Gateway ist von ioBroker aus erreichbar (gleiches Netzwerk). Eine DHCP-Reservierung wird empfohlen; ohne eingetragene IP-Adresse findet der Adapter das Gateway über dessen UDP-Broadcasts (Ports 6666/6667).
4. **Tuya-Geräte akzeptieren meist nur eine lokale Verbindung.** In einem Test waren MiBoxer-App und Adapter gleichzeitig verbunden; scheitert die Verbindung aber immer wieder, schließe die App auf Smartphones im selben Netzwerk und steuere das Gateway nicht gleichzeitig mit anderen lokalen Integrationen (ioBroker.tuya, Home Assistant, tinytuya).

## Konfiguration

Die Instanzeinstellungen haben zwei Reiter: **Gateway** (Verbindung und Zonensteuerung) und **Timer** (siehe [Timer](#timer)).

| Einstellung | Beschreibung |
| --- | --- |
| Geräte-ID | Tuya-Geräte-ID des WL-433-Gateways |
| Local Key | 16-stelliger Tuya-Local-Key (verschlüsselt gespeichert) |
| IP-Adresse des Gateways | Leer lassen, um das Gateway automatisch im lokalen Netzwerk zu finden |
| Tuya-Protokollversion | 3.3 für das WL-433 (3.1, 3.4 und 3.5 wählbar) |
| Gateway im lokalen Netzwerk suchen | Schaltfläche: findet das Gateway anhand der Geräte-ID und trägt IP-Adresse und Protokollversion ein. Ohne Geräte-ID werden alle gefundenen Tuya-Geräte aufgelistet |
| Wartezeit bis zum Neuverbinden | Sekunden bis zum erneuten Verbindungsversuch (Standard 30) |
| Intervall für die Statusabfrage | Sekunden zwischen vollständigen Statusabfragen (Standard 60, 0 = nur vom Gateway gesendete Aktualisierungen) |
| Zonensteuerung | *Zonenwahl* (Standard) oder *ein Kanal je Zone*, siehe [Zonen](#zonen) |

## Zonen

Das Gateway steuert bis zu 8 Zonen (wie die Fernbedienung FUT086). Jeder Befehl kann an eine Zone oder an alle Zonen gehen, das Gateway meldet aber **nur einen Status für alle Leuchten: die letzte Einstellung, egal an welche Zone sie ging**. Auch die MiBoxer-App zeigt keinen eigenen Status je Zone. Die Einstellung *Zonensteuerung* bietet zwei Varianten:

| Variante | Datenpunkte | Geeignet für |
| --- | --- | --- |
| **Zonenwahl (Standard)** | `light.*` zeigt den Status des Gateways. `light.zone` (0 = alle Zonen, 1–8) legt fest, an welche Zone die Befehle von `light.*` gehen. | Die meisten Anwender: jeder Datenpunkt zeigt, was das Gateway meldet |
| **Ein Kanal je Zone** | `light.*` zeigt den Status des Gateways und sendet an alle Zonen. Zusätzlich steuern `zones.zone1` … `zones.zone8` jede Zone einzeln. Ein Zonenkanal zeigt die zuletzt an diese Zone gesendeten und vom Gateway bestätigten Werte; er bleibt leer, bis etwas an die Zone gesendet wurde. | Skripte und Visualisierungen, die Zonen direkt ansprechen |

Wird die Einstellung geändert, werden die Datenpunkte der anderen Variante gelöscht.

## Timer

Der Reiter **Timer** der Instanzeinstellungen nimmt bis zu **50 Timer** auf. Sie laufen lokal im Adapter, auch ohne Internet, und können mehr als die Timer der MiBoxer-App: Sonnenereignisse mit Verschiebung, zufällige Abweichung, Saison, Zonen, Farben, Szenen und Ausschalten nach einer Dauer. Ein Timer wird mit **+** hinzugefügt, zum Ändern aufgeklappt und mit den Schaltflächen des Eintrags kopiert oder gelöscht. Änderungen gelten nach dem Speichern der Einstellungen (die Instanz startet neu).

| Feld | Beschreibung |
| --- | --- |
| Aktiv | Schaltet diesen Timer ab, ohne ihn zu löschen |
| Name | Erscheint im Log und in `timers.overview` |
| Auslöser | *Uhrzeit* oder ein Sonnenereignis: Morgendämmerung, Sonnenaufgang, goldene Stunde (abends), Sonnenuntergang, Abenddämmerung, Nacht |
| Uhrzeit | Nur beim Auslöser *Uhrzeit* |
| Verschiebung | Minuten (−720 bis 720), negativ = früher – z. B. Sonnenuntergang −15 |
| Zufällige Abweichung | Bis zu ± Minuten (0–120), bei jedem Lauf neu ausgewürfelt – für eine Anwesenheitssimulation |
| Wochentage | Tage, an denen der Timer läuft |
| Saison von / bis | `TT.MM.`, z. B. `01.05.` bis `30.09.`; eine Saison über den Jahreswechsel (`01.11.` bis `28.02.`) funktioniert ebenfalls; leer = ganzjährig |
| Zone | Alle Zonen oder Zone 1–8 |
| Aktion | Einschalten, Ausschalten, Weißlicht (Farbtemperatur 2700–6500 K), Farbe, Szene M1–M9, nur Helligkeit |
| Helligkeit | 1–100 %, leer = unverändert (nicht bei *Ausschalten*) |
| Ausschalten nach | Minuten (0–1440), 0 = nicht ausschalten (nicht bei *Ausschalten*) |

- **Sonnenereignisse** werden aus der Position in den ioBroker-Systemeinstellungen (Breiten- und Längengrad) mit [suncalc](https://github.com/mourner/suncalc) berechnet. Ohne Position werden diese Timer mit einer Warnung ignoriert. An Tagen ohne das Ereignis (Polargebiete) läuft der Timer nicht.
- Ein Timer sendet dieselben Befehle wie die Datenpunkte: bei der Zonensteuerung *Zonenwahl* an seine Zone (`light.zone` wird nicht verändert), bei *ein Kanal je Zone* über `zones.zone<n>` (alle Zonen: `light.*`). Das Gateway bestätigt sie wie jeden Befehl.
- Ist das Gateway zum Zeitpunkt eines Timers nicht verbunden, entfällt dieser Lauf (Warnung im Log) – er wird nicht nachgeholt.
- Timer mit unvollständigen Einstellungen werden ignoriert; das Log und `timers.overview` nennen den Grund.
- Die Zeiten sind Ortszeiten des ioBroker-Systems; die Sommerzeit wird berücksichtigt.
- Die **Timer der MiBoxer-App** werden in der Tuya-Cloud gespeichert und ausgeführt (sie schalten nur alle Zonen über Datenpunkt 20 ein oder aus und brauchen Internet). Der Adapter kann sie weder lesen noch ändern, sieht ihre Wirkung aber im Status. Beide Timerarten lassen sich gleichzeitig verwenden.

## Datenpunkte

| State | Beschreibung |
| --- | --- |
| `info.connection` | Verbindung zum Gateway |
| `info.ip` | Verwendete IP-Adresse des Gateways |
| `light.on` | Ein / Aus |
| `light.mode` | `white`, `colour` oder `scene` – Schreiben wechselt den Modus (Farbmodus mit dem letzten Farbton, Szenenmodus mit der letzten Szene) |
| `light.brightness` | Helligkeit 1–100 % des aktuellen Modus. 0 schaltet aus, ein Wert über 0 schaltet ein |
| `light.colorTemperature` | Farbtemperatur 2700–6500 K in Schritten von 100 K (schaltet in den Weißmodus) |
| `light.color` | Farbe als `#rrggbb` bei voller Helligkeit (schaltet in den Farbmodus). Schreiben setzt Farbton und Sättigung, die Helligkeit des RGB-Werts wird ignoriert – dafür gibt es `light.brightness` |
| `light.hue` | Farbton 0–360° (schaltet in den Farbmodus) |
| `light.saturation` | Sättigung 0–100 % (schaltet in den Farbmodus) |
| `light.scene` | Szene 1–9 (M1–M9 in der App), 0 = keine Szene. Schreiben von 1–9 startet die Szene |
| `light.speedUp` / `light.speedDown` | Tasten S+ / S- der App: Szene schneller / langsamer. Das Gateway meldet die Geschwindigkeit nicht |
| `light.countdown` | Sekunden, bis das Gateway die Leuchten umschaltet (0 = aus, Standard-Datenpunkt 26) |
| `light.zone` | Nur bei der Zonenwahl: Zone der `light.*`-Befehle, 0 = alle Zonen, 1–8 |
| `zones.zone<n>.*` | Nur bei einem Kanal je Zone: `on`, `mode`, `brightness`, `colorTemperature`, `color`, `hue`, `saturation`, `scene`, `speedUp`, `speedDown` für Zone n |
| `dp101.raw` | Letzter Frame von Datenpunkt 101 als Base64 – Schreiben sendet den Wert unverändert |
| `dp101.hex` | Letzter Frame von Datenpunkt 101 als Hex-Bytes – Schreiben sendet den Frame, die Prüfsumme wird automatisch ergänzt oder korrigiert |
| `dp101.checksumValid` | Prüfsumme des letzten Frames ist gültig |
| `dp101.history` | JSON-Liste der letzten 50 Frames (`rx` = empfangen, `tx` = gesendet) mit Zeitstempel; wiederholte gleiche Statusantworten werden nicht aufgenommen |
| `raw.dp<n>` | Jeder weitere vom Gateway gemeldete Datenpunkt wird automatisch angelegt (schreibbar) |
| `settings.dmxAddress` | Startadresse 1–512 des DMX512-Eingangs des Gateways – ab dort wertet es 5 Kanäle aus: Rot, Grün, Blau, Kaltweiß, Warmweiß (Menü *DMX* in der App). Schreiben sendet sie an die Zone aus `light.zone` (Zonenwahl) oder an alle Zonen; das Gateway bestätigt sie |
| `timers.active` | `false` pausiert alle Timer (z. B. im Urlaub oder per Skript), `true` lässt sie wieder laufen |
| `timers.nextRun` | Nächster Timerlauf mit dem Namen des Timers (`paused (…)`, solange `timers.active` `false` ist) |
| `timers.lastRun` | Letzter Timerlauf mit Name und Aktion |
| `timers.overview` | JSON-Liste aller Timer: Zeitplan, Aktion, nächster Lauf, Grund, falls der Timer ignoriert wird |

Werte, die einen bestimmten Modus oder eingeschaltete Leuchten brauchen, sendet der Adapter wie die MiBoxer-App: eine Farbtemperatur im Farbmodus schaltet z. B. zuerst in den Weißmodus, eine Helligkeit bei ausgeschalteten Leuchten schaltet sie zuerst ein. Schnelle Änderungen (z. B. von einem Schieberegler) werden zusammengefasst, nur der letzte Wert wird gesendet. Befehle werden nur angenommen, solange das Gateway verbunden ist. Ein Befehl gilt als ausgeführt, wenn der nächste Status des Gateways seine Werte zeigt (etwa 2,5 s später); bis dahin ist der Datenpunkt nicht bestätigt.

## Datenpunkt 101 – Protokoll

Das WL-433 überträgt Leuchten, Zonen und Szenen im herstellerspezifischen Datenpunkt 101: 12-Byte-Frames, Base64-kodiert, das letzte Byte ist die 8-Bit-Summe der Bytes 0–10. Das Format wurde am 22.09.2026 aus den Statusframes eines echten Gateways und den Befehlen entschlüsselt, die die MiBoxer-App in ihr Android-Log schreibt:

| Frame | Bytes (hex) | Bedeutung |
| --- | --- | --- |
| Befehl (App / Adapter → Gateway) | `41 00 00 0B cc vv vv vv vv zz 80 ss` | `cc` Befehl: `01` Farbton 0–255 (Wert in Byte 5–8, schaltet in den Farbmodus), `02` Helligkeit 1–100 %, `03` Farbtemperatur 0–38 (2700 K + 100 K je Stufe), `04` Sättigung 0–100 %, `05` Szene 1–9, `06` Taste (`01` ein, `02` aus, `03` S-, `04` S+, `06` Weißmodus); `zz` Zone: `00` alle, `01`–`08` |
| Statusabfrage | `43 00 00 80 00 00 00 00 00 80 80 C3` | das Gateway antwortet mit einem Statusframe `44` |
| Status (Gateway → App) | `42` / `44` `00 00 00 mm hh tt bb ss 0B dd xx` | `42` Änderungsmeldung (etwa 2,5 s nach der letzten Änderung), `44` Antwort auf die Abfrage; `mm` Modus: `00` aus, `01` Farbe, `02` Weiß, `03`–`0B` Szene 1–9; `hh` Farbton, `tt` Farbtemperaturstufe, `bb` Helligkeit, `ss` Sättigung (0 im Weißmodus), `dd` unteres Byte der DMX-Startadresse. Die Zone ist nicht Teil des Status |
| DMX-Startadresse | `49 00 00 0B 02 aa aa 00 00 zz 80 ss` | `aa aa` Adresse 1–512 (oberes Byte, unteres Byte), `zz` Zone; Antwort `49 00 00 0B 02 01 tt bb ss aa aa xx` |

Die Taste `06 05` schaltet die Leuchten ebenfalls aus (ein zweites Mal lässt sie sie aus, sie schaltet nicht um); was sie anders macht als `06 02`, ist noch unbekannt, der Adapter verwendet sie nicht. Die Standard-Datenpunkte 20–23 leitet das Gateway aus diesen Befehlen ab; der Adapter verwendet nur Datenpunkt 20 (ein/aus, kommt früher als der Status) und folgt ansonsten dem Status aus Datenpunkt 101. Schreiben des Tuya-Farbdatenpunkts 24 ändert die Farbe der Leuchten nicht – auch die MiBoxer-App nutzt ihn nicht.

Rohzugriff für eigene Versuche: `dp101.hex` nimmt 11 Bytes an (die Prüfsumme wird angehängt), z. B. fragt `43 00 00 80 00 00 00 00 00 80 80` den Status ab.

## Einschränkungen

- Das Gateway meldet einen Status für alle Leuchten (die letzte Einstellung), nicht den Status jeder Zone – siehe [Zonen](#zonen).
- Die Geschwindigkeit einer Szene (S+ / S-) meldet das Gateway nicht.
- Ob eine Leuchte einen Befehl per Funk tatsächlich empfangen hat, ist nicht erkennbar: der Status stammt vom Gateway.
- Das Gateway meldet seinen Status weiterhin an die Tuya-Cloud. Eine vollständige Internetsperre kann es unzuverlässig machen. Die Timer der MiBoxer-App brauchen die Cloud, die Timer des Adapters nicht.

## Protokollierung und Fehlersuche

Der Adapter protokolliert nach einem festen Schema, damit das Log jederzeit für eine Fehlersuche aussagekräftig ist:

| Stufe | Was protokolliert wird |
| --- | --- |
| error | Konfigurationsfehler, mit denen der Adapter nicht arbeiten kann (Geräte-ID fehlt, Local Key nicht 16 Zeichen) |
| warn | Probleme, bei denen du handeln musst – einmal gemeldet, danach nur noch auf Debug-Stufe, bis sie behoben sind: Gateway weist Verbindungen ab, Daten nicht entschlüsselbar (falscher Local Key), Befehle vom Gateway nicht bestätigt, Statusabfragen unbeantwortet, unerwartete Datenpunktwerte oder Statusframes, Timer mit unvollständigen Einstellungen oder ohne Position für Sonnenereignisse, Timer, die die Leuchten nicht schalten konnten, eine vom Gateway nicht bestätigte DMX-Startadresse |
| info | Meilensteine: Konfigurationsübersicht beim Start, Gateway gefunden, verbunden, Verbindung verloren, Verbindung wieder stabil, Datenpunkte der anderen Zonenvariante entfernt, Anzahl der aktiven Timer, Timer pausiert oder wieder aktiv |
| debug | Jeder Schritt mit Eingaben, Entscheidungen und Laufzeiten: Datenpunktänderung → Umsetzung in Frames von Datenpunkt 101 (mit Grund für zusätzliche Frames wie „zuerst einschalten“) → Warteschlange → Senden → Bestätigung durch den Status (oder welcher Wert noch fehlt), jeder empfangene Datenpunkt und Status und die aktualisierten States, Statusabfragen, Suche, jeder Timer mit Zeitplan, nächstem Lauf (Sonnenereignis, Verschiebung, Zufallsabweichung) und Ausführung. Befehle (`#12`) und Verbindungsversuche (`Attempt #3`) sind nummeriert, sodass sich alle Zeilen eines Befehls verfolgen lassen |
| silly | Zusätzlich die Protokollspur der Bibliothek tuyapi (Pakete, Ping/Pong) mit der Kennung `[tuyapi]` |

Jede Meldung beginnt mit einer Kennung: `[cfg]` Konfiguration, `[conn]` Verbindung, `[rx]` Gateway → States, `[cmd]` States → Befehle, `[queue]` Befehlswarteschlange, `[poll]` Statusabfrage, `[disc]` Suche, `[dp101]` Roh-Frames, `[timer]` Timer, `[unload]` Beenden, `[tuyapi]` Bibliotheksspur. Local Key und Sitzungsschlüssel erscheinen nie im Log – die Konfigurationsübersicht zeigt nur die Länge des Schlüssels.

Stufe ändern: Admin → **Instanzen** → Expertenmodus → Log-Stufe von `miboxer-wl433.0` → `debug` (oder `silly` für die Protokollspur; danach die Instanz neu starten). Bitte hänge bei Fehlermeldungen ein Debug-Log und den Inhalt von `dp101.history` an.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.2.1 (2026-09-22)

- (ssbingo) Objektnamen in allen 11 Sprachen des Admins (Objektprüfung E6001 des ioBroker-Repositorys); vorhandene Objekte werden beim nächsten Start aktualisiert

### 0.2.0 (2026-09-22)

- (ssbingo) Lokale Timer im neuen Reiter *Timer* der Instanzeinstellungen (bis zu 50): Uhrzeit oder Sonnenereignis mit Verschiebung und Zufallsabweichung, Wochentage, Saison, Zone, jede Lichtaktion und Ausschalten nach einer Dauer; Datenpunkte `timers.active`, `timers.nextRun`, `timers.lastRun` und `timers.overview`
- (ssbingo) DMX-Startadresse des DMX512-Eingangs les- und schreibbar (`settings.dmxAddress`)
- (ssbingo) Dokumentiert: DMX-Befehl, Taste `06 05`, Cloud-Timer der MiBoxer-App; Handbücher mit neuem Timer-Kapitel

### 0.1.0 (2026-09-22)

- (ssbingo) Datenpunkt 101 entschlüsselt: Leuchten, Zonen und Szenen werden jetzt mit den eigenen Befehlen des Gateways gesteuert (die Farbe ließ sich vorher nicht setzen), der Status wird aus Datenpunkt 101 gelesen und aktiv abgefragt
- (ssbingo) Neue Datenpunkte: Farbton, Sättigung, Szene M1–M9, Tasten S+ / S-; Zonen in den Einstellungen wählbar als Zonenwahl (`light.zone`) oder ein Kanal je Zone
- (ssbingo) Befehle werden durch den Status des Gateways bestätigt, eine Warnung erscheint, wenn das Gateway sie nicht bestätigt; ausführliche Debug-Ausgaben für jeden Schritt
- (ssbingo) Deutsches und englisches Handbuch für Einsteiger

### 0.0.1 (2026-09-21)

- (ssbingo) Erste Version: lokale Steuerung des WL-433-Gateways über das Tuya-LAN-Protokoll (Ein/Aus, Modus, Helligkeit, Farbtemperatur, Farbe, Countdown), Rohzugriff auf Datenpunkt 101 mit Prüfsummenbehandlung und Gateway-Suche im lokalen Netzwerk, ausführliches Debug-Logging mit Komponenten-Kennungen, Befehlsnummern und Laufzeiten (Geheimnisse werden nie protokolliert)

## Lizenz

MIT-Lizenz – Copyright (c) 2026 ssbingo. Der vollständige Lizenztext steht im [English README](../../README.md#license) und in der Datei [LICENSE](../../LICENSE).
