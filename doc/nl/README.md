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

In de WL-433 zit een Tuya-wifimodule. In het lokale netwerk is de gateway **één** Tuya-apparaat: alle gekoppelde lampen worden via dit ene apparaat bestuurd en de gateway stuurt de opdrachten via LoRa (433 MHz) naar de lampen. De adapter spreekt het **Tuya-LAN-protocol 3.3** (TCP-poort 6668, AES-versleuteld met de local key) rechtstreeks met de gateway, op basis van de beproefde bibliotheek [tuyapi](https://github.com/codetheweb/tuyapi) (ook gebruikt door ioBroker.tuya). De protocolversies 3.1, 3.4 en 3.5 worden ook ondersteund, voor het geval een firmware-update die wijzigt.

Lampen, zones en scènes worden bestuurd met de eigen opdrachten van de gateway in het fabrikantspecifieke **datapunt 101** — dezelfde opdrachten die de MiBoxer-app verstuurt. De gateway meldt zijn status op dezelfde manier; de adapter vraagt die bovendien op bij het verbinden en bij elke statusverversing.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

**Gebruikershandleiding** waarin elke stap voor beginners wordt uitgelegd (installatie, instellingen, zones, timers, voorbeelden, probleemoplossing): [English](../Manual_miboxer-wl433.md) ([PDF](../Manual_miboxer-wl433.pdf)) · [Deutsch](../Handbuch_miboxer-wl433.md) ([PDF](../Handbuch_miboxer-wl433.pdf)).

Achtergrondonderzoek (protocolanalyse, bronnen, testplan, ontcijferd datapunt 101), in het Duits: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Handleiding voor het koppelen van de lampen aan de gateway: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Ondersteunde hardware

| Apparaat | Rol | Status |
| --- | --- | --- |
| MiBoxer WL-433 | Vereist, de adapter maakt er verbinding mee | Getest met een echte gateway (Tuya-protocol 3.3, datapunt 101) |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lamp, gekoppeld aan de gateway | Doelapparaat |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lamp, gekoppeld aan de gateway | Zelfde productfamilie, zou moeten werken |
| MiBoxer UW01, UW02, UW03, RD-9L | Lamp, gekoppeld aan de gateway | Niet getest |

## Vereisten

1. De gateway is ingericht in de MiBoxer-app en de lampen zijn eraan gekoppeld.
2. **Apparaat-ID en local key** van de gateway. De fabrikant ondersteunt het Tuya-ontwikkelaarsplatform niet voor de WL-433, maar de MiBoxer-app schrijft beide waarden naar zijn debuglog: lees op Android het log met een logcat-viewer zoals *LogFox* terwijl de app start en de gateway bestuurt. **De local key verandert telkens wanneer de gateway opnieuw wordt gekoppeld** — dan moet hij opnieuw worden uitgelezen en ingevoerd. Stap-voor-stapgids voor beginners (in het Duits, voor Android, iPhone en iPad): [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](../Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](../Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. De gateway is bereikbaar vanuit ioBroker (hetzelfde netwerk). Een DHCP-reservering wordt aanbevolen; zonder ingesteld IP-adres vindt de adapter de gateway via zijn UDP-broadcasts (poorten 6666/6667).
4. **Tuya-apparaten accepteren meestal maar één lokale verbinding.** Bij een test waren de MiBoxer-app en de adapter tegelijk verbonden; mislukt de verbinding echter steeds weer, sluit dan de app op telefoons in hetzelfde netwerk en bestuur de gateway niet tegelijk met andere lokale integraties (ioBroker.tuya, Home Assistant, tinytuya).

## Configuratie

De instellingen van de instantie hebben twee tabbladen: **Gateway** (verbinding en zonebesturing) en **Timers** (zie [Timers](#timers)).

| Instelling | Beschrijving |
| --- | --- |
| Apparaat-ID | Tuya-apparaat-ID van de WL-433-gateway |
| Local key | Tuya-local-key van 16 tekens (versleuteld opgeslagen) |
| IP-adres van de gateway | Leeg laten om de gateway automatisch in het lokale netwerk te vinden |
| Tuya-protocolversie | 3.3 voor de WL-433 (3.1, 3.4 en 3.5 kiesbaar) |
| Gateway zoeken in het lokale netwerk | Knop: vindt de gateway aan de hand van de apparaat-ID en vult IP-adres en protocolversie in. Zonder apparaat-ID worden alle gevonden Tuya-apparaten weergegeven |
| Wachttijd voor opnieuw verbinden | Seconden tot een verloren of mislukte verbinding opnieuw wordt geprobeerd (standaard 30) |
| Interval voor statusverversing | Seconden tussen volledige statusopvragingen (standaard 60, 0 = alleen de door de gateway verstuurde updates) |
| Zonebesturing | *Zonekeuze* (standaard) of *één kanaal per zone*, zie [Zones](#zones) |

## Zones

De gateway bestuurt tot 8 zones (zoals de afstandsbediening FUT086). Elke opdracht kan naar één zone of naar alle zones gaan, maar de gateway meldt **slechts één status voor alle lampen: de laatste instelling, ongeacht naar welke zone die is gestuurd**. Ook de MiBoxer-app toont geen aparte status per zone. De instelling *Zonebesturing* biedt twee varianten:

| Variant | Datapunten | Geschikt voor |
| --- | --- | --- |
| **Zonekeuze (standaard)** | `light.*` toont de status van de gateway. `light.zone` (0 = alle zones, 1–8) bepaalt naar welke zone de opdrachten van `light.*` gaan. | De meeste gebruikers: elk datapunt toont wat de gateway meldt |
| **Eén kanaal per zone** | `light.*` toont de status van de gateway en stuurt naar alle zones. Daarnaast besturen `zones.zone1` … `zones.zone8` elke zone afzonderlijk. Een zonekanaal toont de laatste waarden die naar deze zone zijn gestuurd en door de gateway zijn bevestigd; het blijft leeg tot er iets naar de zone is gestuurd. | Scripts en visualisaties die zones rechtstreeks aansturen |

Als de instelling wordt gewijzigd, worden de datapunten van de andere variant verwijderd.

## Timers

Het tabblad **Timers** van de instellingen van de instantie bevat maximaal **50 timers**. Ze draaien lokaal in de adapter, ook zonder internet, en kunnen meer dan de timers van de MiBoxer-app: zonnegebeurtenissen met verschuiving, willekeurige afwijking, seizoen, zones, kleuren, scènes en uitschakelen na een bepaalde duur. Voeg een timer toe met **+**, open hem om hem te wijzigen, kopieer of verwijder hem met de knoppen van het item. Wijzigingen worden van kracht wanneer de instellingen worden opgeslagen (de instantie wordt opnieuw gestart).

| Veld | Beschrijving |
| --- | --- |
| Actief | Deactiveert deze timer zonder hem te verwijderen |
| Naam | Wordt getoond in het log en in `timers.overview` |
| Trigger | *Tijdstip* of een zonnegebeurtenis: dageraad, zonsopkomst, gouden uur (avond), zonsondergang, schemering, nacht |
| Tijdstip | Alleen voor de trigger *Tijdstip* |
| Verschuiving | Minuten (−720 tot 720), negatief = eerder — bijv. zonsondergang −15 |
| Willekeurige afwijking | Tot ± minuten (0–120), bij elke uitvoering opnieuw willekeurig bepaald — voor een aanwezigheidssimulatie |
| Weekdagen | Dagen waarop de timer wordt uitgevoerd |
| Seizoen van / tot | `DD.MM.`, bijv. `01.05.` tot `30.09.`; een seizoen over de jaarwisseling heen (`01.11.` tot `28.02.`) werkt ook; leeg = het hele jaar |
| Zone | Alle zones of zone 1–8 |
| Actie | Inschakelen, uitschakelen, wit licht (kleurtemperatuur 2700–6500 K), kleur, scène M1–M9, alleen helderheid |
| Helderheid | 1–100 %, leeg = ongewijzigd (niet bij *Uitschakelen*) |
| Uitschakelen na | Minuten (0–1440), 0 = niet uitschakelen (niet bij *Uitschakelen*) |

- **Zonnegebeurtenissen** worden berekend uit de positie in de systeeminstellingen van ioBroker (breedte- en lengtegraad) met [suncalc](https://github.com/mourner/suncalc). Zonder positie worden deze timers met een waarschuwing genegeerd. Op dagen zonder de gebeurtenis (poolgebieden) wordt de timer niet uitgevoerd.
- Een timer verstuurt dezelfde opdrachten als de datapunten: in de zonemodus *zonekeuze* naar zijn zone (`light.zone` wordt niet gewijzigd), in de modus *één kanaal per zone* via `zones.zone<n>` (alle zones: `light.*`). De gateway bevestigt ze zoals elke opdracht.
- Als de gateway niet verbonden is wanneer een timer aan de beurt is, wordt deze uitvoering overgeslagen (waarschuwing in het log) — ze wordt later niet ingehaald.
- Timers met onvolledige instellingen worden genegeerd; het log en `timers.overview` noemen de reden.
- De tijden zijn lokale tijden van het ioBroker-systeem; er wordt rekening gehouden met de zomertijd.
- De **timers van de MiBoxer-app** worden in de Tuya-cloud opgeslagen en uitgevoerd (ze schakelen alleen alle zones aan of uit via datapunt 20 en hebben internet nodig). De adapter kan ze niet lezen of wijzigen, maar ziet hun effect in de status. Beide soorten timers kunnen tegelijk worden gebruikt.

## Datapunten

| State | Beschrijving |
| --- | --- |
| `info.connection` | Verbinding met de gateway |
| `info.ip` | Gebruikt IP-adres van de gateway |
| `light.on` | Aan / uit |
| `light.mode` | `white`, `colour` of `scene` — schrijven wisselt de modus (kleurmodus met de laatste tint, scènemodus met de laatste scène) |
| `light.brightness` | Helderheid 1–100 % van de huidige modus. 0 schakelt uit, een waarde boven 0 schakelt in |
| `light.colorTemperature` | Kleurtemperatuur 2700–6500 K in stappen van 100 K (schakelt naar de witmodus) |
| `light.color` | Kleur als `#rrggbb` bij volle helderheid (schakelt naar de kleurmodus). Schrijven stelt tint en verzadiging in, de helderheid van de RGB-waarde wordt genegeerd — gebruik daarvoor `light.brightness` |
| `light.hue` | Tint 0–360° (schakelt naar de kleurmodus) |
| `light.saturation` | Verzadiging 0–100 % (schakelt naar de kleurmodus) |
| `light.scene` | Scène 1–9 (M1–M9 in de app), 0 = geen scène. Schrijven van 1–9 start de scène |
| `light.speedUp` / `light.speedDown` | Knoppen S+ / S- van de app: scène sneller / langzamer. De gateway meldt de snelheid niet |
| `light.countdown` | Seconden tot de gateway de lampen omschakelt (0 = uit, standaarddatapunt 26) |
| `light.zone` | Alleen bij de zonekeuze: zone van de `light.*`-opdrachten, 0 = alle zones, 1–8 |
| `zones.zone<n>.*` | Alleen bij één kanaal per zone: `on`, `mode`, `brightness`, `colorTemperature`, `color`, `hue`, `saturation`, `scene`, `speedUp`, `speedDown` voor zone n |
| `dp101.raw` | Laatste frame van datapunt 101 als Base64 — schrijven verstuurt de waarde ongewijzigd |
| `dp101.hex` | Laatste frame van datapunt 101 als hex-bytes — schrijven verstuurt het frame, de controlesom wordt automatisch toegevoegd of gecorrigeerd |
| `dp101.checksumValid` | Controlesom van het laatste frame is geldig |
| `dp101.history` | JSON-lijst van de laatste 50 frames (`rx` = ontvangen, `tx` = verzonden) met tijdstempel; herhaalde identieke statusantwoorden worden niet toegevoegd |
| `raw.dp<n>` | Elk verder datapunt dat de gateway meldt, wordt automatisch aangemaakt (schrijfbaar) |
| `settings.dmxAddress` | Startadres 1–512 van de DMX512-ingang van de gateway – vanaf dit adres gebruikt de gateway 5 kanalen: rood, groen, blauw, koud wit, warm wit (menu *DMX* in de app). Schrijven verstuurt het naar de zone van `light.zone` (zonekeuze) of naar alle zones; de gateway bevestigt het |
| `timers.active` | `false` pauzeert alle timers (bijv. tijdens de vakantie of vanuit een script), `true` activeert ze weer |
| `timers.nextRun` | Volgende uitvoering van een timer met de naam van de timer (`paused (…)` zolang `timers.active` `false` is) |
| `timers.lastRun` | Laatste uitvoering van een timer met naam en actie |
| `timers.overview` | JSON-lijst van alle timers: planning, actie, volgende uitvoering, reden als de timer wordt genegeerd |

Waarden die een modus of ingeschakelde lampen nodig hebben, verstuurt de adapter zoals de MiBoxer-app: een kleurtemperatuur in kleurmodus schakelt bijvoorbeeld eerst naar de witmodus, een helderheid bij uitgeschakelde lampen schakelt ze eerst in. Snelle wijzigingen (bijv. van een schuifregelaar) worden samengevoegd, alleen de laatste waarde wordt verstuurd. Opdrachten worden alleen aangenomen zolang de gateway verbonden is. Een opdracht geldt als uitgevoerd wanneer de volgende status van de gateway de waarden ervan toont (ongeveer 2,5 s later); tot dan is het datapunt niet bevestigd.

## Datapunt 101 — protocol

De WL-433 transporteert lampen, zones en scènes in het fabrikantspecifieke datapunt 101: frames van 12 bytes, Base64-gecodeerd, de laatste byte is de 8-bitsom van de bytes 0–10. Het formaat werd op 22-09-2026 ontcijferd uit de statusframes van een echte gateway en de opdrachten die de MiBoxer-app naar zijn Android-log schrijft:

| Frame | Bytes (hex) | Betekenis |
| --- | --- | --- |
| Opdracht (app / adapter → gateway) | `41 00 00 0B cc vv vv vv vv zz 80 ss` | `cc` opdracht: `01` tint 0–255 (waarde in byte 5–8, schakelt naar de kleurmodus), `02` helderheid 1–100 %, `03` kleurtemperatuur 0–38 (2700 K + 100 K per stap), `04` verzadiging 0–100 %, `05` scène 1–9, `06` toets (`01` aan, `02` uit, `03` S-, `04` S+, `06` witmodus); `zz` zone: `00` alle, `01`–`08` |
| Statusopvraging | `43 00 00 80 00 00 00 00 00 80 80 C3` | de gateway antwoordt met een statusframe `44` |
| Status (gateway → app) | `42` / `44` `00 00 00 mm hh tt bb ss 0B dd xx` | `42` wijzigingsmelding (ongeveer 2,5 s na de laatste wijziging), `44` antwoord op de opvraging; `mm` modus: `00` uit, `01` kleur, `02` wit, `03`–`0B` scène 1–9; `hh` tint, `tt` kleurtemperatuurstap, `bb` helderheid, `ss` verzadiging (0 in witmodus), `dd` lage byte van het DMX-startadres. De zone maakt geen deel uit van de status |
| DMX-startadres | `49 00 00 0B 02 aa aa 00 00 zz 80 ss` | `aa aa` adres 1–512 (hoge byte, lage byte), `zz` zone; antwoord `49 00 00 0B 02 01 tt bb ss aa aa xx` |

De toets `06 05` schakelt de lampen ook uit (een tweede keer houdt hij ze uit, hij wisselt niet tussen aan en uit); wat hij anders doet dan `06 02` is nog onbekend, de adapter gebruikt hem niet. De standaarddatapunten 20–23 leidt de gateway af uit deze opdrachten; de adapter gebruikt alleen datapunt 20 (aan/uit, komt eerder dan de status) en volgt voor al het andere de status uit datapunt 101. Het schrijven van het Tuya-kleurdatapunt 24 verandert de kleur van de lampen niet — ook de MiBoxer-app gebruikt het niet.

Ruwe toegang voor eigen experimenten: `dp101.hex` accepteert 11 bytes (de controlesom wordt toegevoegd), bijv. `43 00 00 80 00 00 00 00 00 80 80` vraagt de status op.

## Beperkingen

- De gateway meldt één status voor alle lampen (de laatste instelling) en niet de status van elke zone — zie [Zones](#zones).
- De snelheid van een scène (S+ / S-) meldt de gateway niet.
- Of een lamp een opdracht via radio werkelijk heeft ontvangen, is niet te zien: de status komt van de gateway.
- De gateway meldt zijn status nog steeds aan de Tuya-cloud. Het volledig blokkeren van de internettoegang kan hem onbetrouwbaar maken. De timers van de MiBoxer-app hebben de cloud nodig, de timers van de adapter niet.

## Logging en probleemoplossing

De adapter logt volgens een vast schema, zodat het log op elk moment bruikbaar is voor het zoeken naar fouten:

| Niveau | Wat wordt gelogd |
| --- | --- |
| error | Configuratiefouten waardoor de adapter niet kan werken (apparaat-ID ontbreekt, local key niet 16 tekens) |
| warn | Problemen waarop u moet reageren — één keer gemeld en daarna alleen op debugniveau tot ze zijn opgelost: gateway weigert verbindingen, gegevens die niet kunnen worden ontsleuteld (verkeerde local key), opdrachten die de gateway niet bevestigt, onbeantwoorde statusopvragingen, onverwachte datapuntwaarden of statusframes, timers met onvolledige instellingen of zonder positie voor zonnegebeurtenissen, timers die de lampen niet konden schakelen, een DMX-startadres dat de gateway niet bevestigt |
| info | Mijlpalen: configuratieoverzicht bij het starten, gateway gevonden, verbonden, verbinding verbroken, verbinding weer stabiel, objecten van de andere zonevariant verwijderd, aantal actieve timers, timers gepauzeerd of weer actief |
| debug | Elke stap met invoer, beslissingen en duur: datapuntwijziging → vertaling in frames van datapunt 101 (met de reden voor extra frames zoals „eerst inschakelen”) → opdrachtwachtrij → verzenden → bevestiging door de status (of welke waarde nog ontbreekt), elk ontvangen datapunt en elke status en de bijgewerkte datapunten, statusopvragingen, zoeken, elke timer met zijn planning, volgende uitvoering (zonnegebeurtenis, verschuiving, willekeurige afwijking) en uitvoering. Opdrachten (`#12`) en verbindingspogingen (`Attempt #3`) zijn genummerd, zodat alle regels van één opdracht te volgen zijn |
| silly | Daarnaast het protocolspoor van de bibliotheek tuyapi (pakketten, ping/pong) met het label `[tuyapi]` |

Elk bericht begint met een componentlabel: `[cfg]` configuratie, `[conn]` verbinding, `[rx]` gateway → datapunten, `[cmd]` datapunten → opdrachten, `[queue]` opdrachtwachtrij, `[poll]` statusverversing en -opvraging, `[disc]` zoeken, `[dp101]` ruwe frames, `[timer]` timers, `[unload]` afsluiten, `[tuyapi]` bibliotheekspoor. De local key en de sessiesleutels verschijnen nooit in het log — het configuratieoverzicht toont alleen de lengte van de sleutel.

Niveau wijzigen: Admin → **Instanties** → expertmodus → logniveau van `miboxer-wl433.0` → `debug` (of `silly` voor het protocolspoor; start daarna de instantie opnieuw). Voeg bij het melden van een probleem een debuglog en de inhoud van `dp101.history` toe.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.2.1 (2026-09-22)

- (ssbingo) Objectnamen in alle 11 talen van de admin (objectcontrole E6001 van de ioBroker-repository); bestaande objecten worden bij de volgende start bijgewerkt

### 0.2.0 (2026-09-22)

- (ssbingo) Lokale timers in het nieuwe tabblad *Timers* van de instellingen van de instantie (maximaal 50): tijdstip of zonnegebeurtenis met verschuiving en willekeurige afwijking, weekdagen, seizoen, zone, elke lichtactie en uitschakelen na een bepaalde duur; datapunten `timers.active`, `timers.nextRun`, `timers.lastRun` en `timers.overview`
- (ssbingo) Startadres van de DMX512-ingang van de gateway leesbaar en schrijfbaar (`settings.dmxAddress`)
- (ssbingo) Gedocumenteerd: DMX-opdracht, toets `06 05`, cloudtimers van de MiBoxer-app; handleidingen met een nieuw hoofdstuk over timers

### 0.1.0 (2026-09-22)

- (ssbingo) Datapunt 101 ontcijferd: lampen, zones en scènes worden nu bestuurd met de eigen opdrachten van de gateway (de kleur kon eerder niet worden ingesteld), de status wordt uit datapunt 101 gelezen en actief opgevraagd
- (ssbingo) Nieuwe datapunten: tint, verzadiging, scène M1–M9, knoppen S+ / S-; zones in de instellingen kiesbaar als zonekeuze (`light.zone`) of één kanaal per zone
- (ssbingo) Opdrachten worden bevestigd door de status van de gateway, er wordt een waarschuwing gelogd als de gateway ze niet bevestigt; uitgebreide debuguitvoer voor elke stap
- (ssbingo) Duitse en Engelse gebruikershandleiding voor beginners

### 0.0.1 (2026-09-21)

- (ssbingo) Eerste versie: lokale bediening van de WL-433-gateway via het Tuya-LAN-protocol (aan/uit, modus, helderheid, kleurtemperatuur, kleur, aftellen), directe toegang tot datapunt 101 met controlesomafhandeling en zoeken naar de gateway in het lokale netwerk, uitgebreide debuglogging met componentlabels, opdrachtnummers en tijdsduren (geheimen worden nooit gelogd)

## Licentie

MIT-licentie — Copyright (c) 2026 ssbingo. De volledige licentietekst staat in de [English README](../../README.md#license) en in het bestand [LICENSE](../../LICENSE).
