# Handbuch ioBroker.miboxer-wl433

*MiBoxer-Poolbeleuchtung (Gateway WL-433, Leuchten PW01 / PW02) lokal mit ioBroker steuern – Schritt für Schritt erklärt*

| | |
| --- | --- |
| Adapter-Version | 0.1.0 |
| Stand | 22.09.2026 |
| Voraussetzung | ioBroker mit Admin ab Version 8, js-controller ab 6.0.11, Node.js ab 22 |
| Sprache | Deutsch · [English version](Manual_miboxer-wl433.md) |

## Inhalt

1. [Über dieses Handbuch](#1-über-dieses-handbuch)
2. [Was der Adapter macht](#2-was-der-adapter-macht)
3. [Was Sie brauchen](#3-was-sie-brauchen)
4. [Schritt 1 – Leuchten und Gateway in der MiBoxer-App einrichten](#4-schritt-1--leuchten-und-gateway-in-der-miboxer-app-einrichten)
5. [Schritt 2 – Geräte-ID und Local Key besorgen](#5-schritt-2--geräte-id-und-local-key-besorgen)
6. [Schritt 3 – Adapter installieren](#6-schritt-3--adapter-installieren)
7. [Schritt 4 – Instanz einrichten](#7-schritt-4--instanz-einrichten)
8. [Schritt 5 – Prüfen, ob alles funktioniert](#8-schritt-5--prüfen-ob-alles-funktioniert)
9. [Die Poolbeleuchtung bedienen](#9-die-poolbeleuchtung-bedienen)
10. [Zonen](#10-zonen)
11. [Beispiele für Automatisierungen](#11-beispiele-für-automatisierungen)
12. [Fehlersuche](#12-fehlersuche)
13. [Für Neugierige: So funktioniert es im Detail](#13-für-neugierige-so-funktioniert-es-im-detail)
14. [Begriffe](#14-begriffe)
15. [Rechtliches und Kontakt](#15-rechtliches-und-kontakt)

## 1. Über dieses Handbuch

Dieses Handbuch führt Sie von der fertig eingerichteten MiBoxer-App bis zur Poolbeleuchtung, die Sie aus ioBroker heraus schalten, dimmen und färben. Sie brauchen dafür **keine Programmierkenntnisse**. Jeder Schritt ist so beschrieben, dass Sie ihn der Reihe nach abarbeiten können.

**So lesen Sie dieses Handbuch:**

- Arbeiten Sie die Kapitel 3 bis 8 **der Reihe nach** ab. Danach funktioniert die Steuerung.
- Kapitel 9 bis 11 zeigen, was Sie danach alles tun können. Kapitel 12 hilft, wenn etwas nicht klappt.
- Nummerierte Listen sind Handlungsschritte: erst Schritt 1, dann Schritt 2 und so weiter.
- Wörter in `dieser Schrift` tippen Sie genau so ab oder finden sie genau so auf dem Bildschirm.
- Unbekannte Begriffe erklärt Kapitel 14.

Farbige Kästen weisen auf Besonderes hin:

> [!TIP]
> Ein Tipp macht Ihnen die Arbeit leichter.

> [!NOTE]
> Ein Hinweis erklärt Hintergründe.

> [!IMPORTANT]
> Wichtig: Das sollten Sie auf keinen Fall übersehen.

> [!WARNING]
> Achtung: Hier kann etwas schiefgehen, wenn Sie nicht aufpassen.

**Was geprüft ist:** Alle Schritte mit dem Adapter wurden am 22.09.2026 mit einem echten WL-433-Gateway ausprobiert. Die Bilder stammen aus ioBroker Admin 8. Bei einer anderen Admin-Version können Knöpfe leicht anders aussehen oder anders heißen. Stellen, die nicht selbst ausprobiert werden konnten, sind mit **(ungeprüft)** gekennzeichnet.

## 2. Was der Adapter macht

Das MiBoxer-Gateway WL-433 ist die Brücke zwischen Ihrem Heimnetz (WLAN) und den Poolleuchten. Die Leuchten empfangen ihre Befehle per Funk (LoRa, 433 MHz) vom Gateway. Normalerweise steuern Sie das Gateway mit der MiBoxer-App – dabei läuft vieles über das Internet (die „Cloud“ des Herstellers Tuya).

Der Adapter **ioBroker.miboxer-wl433** spricht **direkt im Heimnetz** mit dem Gateway, ohne Umweg über das Internet:

```text
ioBroker  ──(Heimnetz / WLAN)──►  Gateway WL-433  ──(Funk 433 MHz)──►  Poolleuchten PW01 / PW02
```

**Das können Sie mit dem Adapter:**

- Leuchten ein- und ausschalten und dimmen (1–100 %)
- Weißes Licht von warm (2700 K) bis kalt (6500 K) einstellen
- Jede Farbe einstellen, auch blasse Pastelltöne (Farbton und Sättigung)
- Die 9 Farbprogramme M1–M9 der App starten und schneller oder langsamer laufen lassen (S+ / S-)
- Einzelne der 8 Zonen oder alle Zonen gleichzeitig steuern
- Alles mit ioBroker-Skripten, Zeitplänen, Visualisierungen und Sprachassistenten verbinden

**Das kann der Adapter nicht (weil das Gateway es nicht meldet):**

- Er kann nicht anzeigen, welche Zone gerade welche Farbe hat. Das Gateway kennt nur **einen** Zustand für alle Leuchten: die letzte Einstellung. Auch die MiBoxer-App zeigt keinen Unterschied zwischen den Zonen.
- Er kann nicht anzeigen, wie schnell ein Farbprogramm läuft.
- Er kann nicht sehen, ob eine Leuchte den Funkbefehl wirklich empfangen hat. Er sieht nur, was das Gateway meldet.

## 3. Was Sie brauchen

Haken Sie diese Liste ab, bevor Sie anfangen:

- [ ] Ein **MiBoxer WL-433**-Gateway und mindestens eine Leuchte **PW01** oder **PW02**, eingerichtet in der **MiBoxer-App** (Kapitel 4).
- [ ] Eine laufende **ioBroker**-Installation, zum Beispiel auf einem Raspberry Pi. Mindestversionen: **Admin 8**, **js-controller 6.0.11**, **Node.js 22**.
- [ ] Gateway und ioBroker im **selben Heimnetz**.
- [ ] Die **Geräte-ID** und den **Local Key** des Gateways (Kapitel 5). Dafür brauchen Sie einmalig ein **Android-Smartphone oder -Tablet** – ein iPhone oder iPad allein reicht dafür nicht (warum, steht in Kapitel 5).
- [ ] Etwa 30 bis 60 Minuten Zeit.

> [!TIP]
> **So prüfen Sie Ihre ioBroker-Versionen:** Öffnen Sie ioBroker Admin im Browser. Links im Menü finden Sie **Hosts** – dort stehen die Versionen von js-controller und Node.js. Unter **Adapter** zeigt die Kachel **Admin** die installierte Admin-Version.

> [!TIP]
> **Feste IP-Adresse für das Gateway:** Richten Sie in Ihrem Router eine „DHCP-Reservierung“ für das Gateway ein (bei einer FRITZ!Box: *Heimnetz → Netzwerk → Gerät bearbeiten → „Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“*). Dann ändert sich seine Adresse nie. Das ist nicht zwingend, macht den Betrieb aber zuverlässiger.

## 4. Schritt 1 – Leuchten und Gateway in der MiBoxer-App einrichten

Der Adapter übernimmt die Leuchten so, wie sie in der App eingerichtet sind. Richten Sie deshalb zuerst alles in der App ein.

1. Installieren Sie die App **MiBoxer** (Hersteller Futlight) auf Ihrem Smartphone – aus Google Play (Android) oder dem App Store (iPhone/iPad).
2. Legen Sie ein Konto an und fügen Sie das **WL-433-Gateway** hinzu. Folgen Sie dabei den Anweisungen der App.
3. Verknüpfen Sie jede Poolleuchte mit einer **Zone** des Gateways (Zone 1 bis 8). Wie das geht, beschreibt Schritt für Schritt die Anleitung [Anleitung_PW01_mit_WL-433_verbinden.pdf](Anleitung_PW01_mit_WL-433_verbinden.pdf).
4. Probieren Sie in der App aus, ob sich alle Leuchten schalten lassen.

> [!TIP]
> Notieren Sie sich, welche Leuchte in welcher Zone ist. Sie brauchen das später, wenn Sie einzelne Leuchten gezielt steuern möchten:
>
> | Zone | Leuchte (z. B. Einbauort) |
> | --- | --- |
> | 1 | |
> | 2 | |
> | 3 | |

> [!IMPORTANT]
> Wenn Sie das Gateway später aus der App löschen und neu hinzufügen („neu koppeln“), ändert sich sein **Local Key**. Dann müssen Sie Kapitel 5 wiederholen und den neuen Schlüssel im Adapter eintragen.

## 5. Schritt 2 – Geräte-ID und Local Key besorgen

Der Adapter braucht zwei Angaben, um mit dem Gateway sprechen zu dürfen:

| Angabe | Wie sie aussieht | Wofür |
| --- | --- | --- |
| **Geräte-ID** (englisch *Device ID*, im Log *devId*) | etwa 20 bis 22 Zeichen, z. B. `bf0123456789abcdefgh` | Sagt dem Adapter, *welches* Gerät gemeint ist |
| **Local Key** | genau 16 Zeichen, oft mit Sonderzeichen, z. B. `a1B2$c3D4{e5F6g7` | Das „Passwort“ für die verschlüsselte Verbindung |

Die MiBoxer-App zeigt beide Werte nirgends an. Sie schreibt sie aber in ihr internes **Protokoll** (Log) – und dieses Protokoll kann man auf einem **Android-Gerät** mitlesen.

**Der einfachste Weg ist die ausführliche Anleitung** [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)). Sie erklärt jeden Fingertipp – ganz ohne Computer mit den Apps *LogFox* und *Shizuku*, und auch, was Sie mit einem iPhone oder iPad tun können.

### 5.1 Alternative: mit einem Computer und USB-Kabel (Windows)

Dieser Weg wurde am 22.09.2026 mit einem Android-13-Smartphone geprüft.

1. **Entwickleroptionen freischalten:** Auf dem Android-Gerät *Einstellungen → Über das Telefon* öffnen und **7-mal** auf **Build-Nummer** tippen, bis „Sie sind jetzt Entwickler“ erscheint.
2. **USB-Debugging einschalten:** *Einstellungen → System → Entwickleroptionen → USB-Debugging* einschalten. Bei Xiaomi-Geräten zusätzlich **USB-Debugging (Sicherheitseinstellungen)** einschalten.
3. **Werkzeug für den Computer laden:** Laden Sie die **SDK Platform-Tools** von Google herunter: <https://developer.android.com/tools/releases/platform-tools>. Entpacken Sie die ZIP-Datei, zum Beispiel nach `C:\sdk`.
4. **Eingabeaufforderung öffnen:** Windows-Taste drücken, `cmd` tippen, Enter drücken. Dann in den Ordner wechseln: `cd C:\sdk\platform-tools`
5. **Handy verbinden:** Das Handy per USB-Kabel anschließen und entsperren. Es fragt **„USB-Debugging zulassen?“** – Haken bei **„Von diesem Computer immer zulassen“** setzen und **OK** tippen.
6. **Verbindung prüfen:** `adb devices` eingeben. Ihr Gerät muss mit dem Wort `device` erscheinen. Steht dort `unauthorized`, haben Sie die Frage aus Schritt 5 noch nicht bestätigt: Handy entsperren und auf den Bildschirm schauen.
7. **Mitschnitt starten:** `adb logcat -v time > miboxer.txt` eingeben. Das Fenster scheint nun „hängen“ zu bleiben – das ist richtig, es schreibt mit.
8. **App benutzen:** Öffnen Sie die MiBoxer-App, tippen Sie das Gateway an und schalten Sie einmal das Licht aus und wieder ein.
9. **Mitschnitt beenden:** Zurück am Computer **Strg + C** drücken.
10. **Werte suchen:** `findstr /i "localKey devId" miboxer.txt` eingeben. In den gefundenen Zeilen stehen hinter `devId` die Geräte-ID und hinter `localKey` der Local Key.

> [!WARNING]
> Der Local Key ist wie ein Passwort. Geben Sie ihn nicht weiter und veröffentlichen Sie die Datei `miboxer.txt` nirgends. Löschen Sie die Datei, sobald Sie die Werte notiert haben. Schalten Sie danach das **USB-Debugging** in den Entwickleroptionen wieder aus.

### 5.2 Nur iPhone oder iPad vorhanden?

Apple erlaubt keinem Programm, das Protokoll anderer Apps mitzulesen. Am einfachsten leihen Sie sich für zehn Minuten ein Android-Gerät, installieren dort die MiBoxer-App und melden sich mit **Ihrem** MiBoxer-Konto an – das Gateway erscheint dann automatisch, und Sie können wie oben beschrieben vorgehen. Weitere Wege (Android-Emulator auf dem Computer) beschreibt die ausführliche Anleitung; sie sind **(ungeprüft)**.

> [!TIP]
> Die **Geräte-ID** finden Sie auch ohne Log: Nach der Installation des Adapters sucht der Knopf **Gateway im lokalen Netzwerk suchen** (Kapitel 7) alle Tuya-Geräte in Ihrem Heimnetz und zeigt ihre IDs an. Den **Local Key** kann er aber nicht herausfinden.

## 6. Schritt 3 – Adapter installieren

Der Adapter steht noch nicht in der offiziellen Adapterliste von ioBroker. Sie installieren ihn deshalb direkt von GitHub. Sobald er in die Liste aufgenommen ist, genügt es, im Reiter **Adapter** nach `miboxer` zu suchen und auf **+** (Installieren) zu klicken.

### 6.1 Expertenmodus einschalten

1. Öffnen Sie ioBroker Admin im Browser, meist unter `http://<IP-Adresse Ihres ioBroker>:8081`.
2. Klicken Sie links im Menü auf **Adapter**.
3. Klicken Sie links unten auf das **Kopf-Symbol** (rot markiert).

![Expertenmodus einschalten: Kopf-Symbol links unten](img/admin-expert-de.png)

4. Es erscheint ein Hinweis zum Expertenmodus. Klicken Sie auf **Ok**.

![Hinweis zum Expertenmodus](img/admin-expert-dialog-de.png)

> [!NOTE]
> Der Expertenmodus zeigt zusätzliche Knöpfe. Er gilt nur für diese Browsersitzung und schadet nichts. Sie können ihn mit demselben Knopf wieder ausschalten.

### 6.2 Aus GitHub installieren

1. Oben in der Leiste erscheint jetzt ein **Katzen-Symbol** (das GitHub-Logo) mit dem Hinweis **Installieren aus eigener URL**. Klicken Sie darauf.
2. Wählen Sie im Fenster den Reiter **Benutzerdefiniert**.
3. Tragen Sie in das Feld **URL** genau diese Adresse ein: `https://github.com/ssbingo/ioBroker.miboxer-wl433`
4. Lassen Sie den Haken bei **Instanz erstellen, wenn noch keine existiert** gesetzt.
5. Klicken Sie auf **Installieren**.

![Installieren aus eigener URL: Reiter „Benutzerdefiniert“ und Adresse](img/admin-install-de.png)

6. Ein Fenster zeigt den Fortschritt. Warten Sie, bis die Installation beendet ist (das kann auf einem Raspberry Pi einige Minuten dauern), und schließen Sie das Fenster.

> [!NOTE]
> Die rote Warnung im Fenster ist ein allgemeiner Hinweis von ioBroker für alle Adapter, die nicht aus der offiziellen Liste stammen.

**Alternative für Geübte – über die Konsole** (zum Beispiel per SSH auf dem ioBroker-Rechner):

```bash
iobroker url https://github.com/ssbingo/ioBroker.miboxer-wl433
iobroker add miboxer-wl433
```

## 7. Schritt 4 – Instanz einrichten

Nach der Installation gibt es eine **Instanz** namens `miboxer-wl433.0` – das ist der „laufende Adapter“ für Ihr Gateway.

1. Klicken Sie links auf **Instanzen**.
2. Suchen Sie die Zeile **miboxer-wl433.0** und klicken Sie auf das **Schraubenschlüssel-Symbol**. Die Einstellungsseite öffnet sich:

![Einstellungsseite der Instanz (Beispielwerte)](img/admin-config-de.png)

3. Füllen Sie die Felder aus:

| Feld | Was Sie eintragen | Beispiel |
| --- | --- | --- |
| **Geräte-ID** | Die Geräte-ID aus Kapitel 5 | `bf0123456789abcdefgh` |
| **Local Key** | Den Local Key aus Kapitel 5 – genau 16 Zeichen, Groß- und Kleinschreibung beachten | `a1B2$c3D4{e5F6g7` |
| **IP-Adresse des Gateways** | Die IP-Adresse des Gateways aus Ihrem Router. **Oder leer lassen** – dann sucht der Adapter das Gateway selbst | `192.168.1.50` |
| **Tuya-Protokollversion** | `3.3` stehen lassen | `3.3` |
| **Wartezeit bis zum Neuverbinden** | Nach wie vielen Sekunden der Adapter es nach einer Störung erneut versucht. `30` passt | `30` |
| **Intervall für die Statusabfrage** | Alle wie viele Sekunden der Adapter den Zustand nachfragt. `60` passt | `60` |
| **Zonensteuerung** | Wie Zonen angeboten werden – siehe unten. Im Zweifel **Zonenwahl** lassen | Zonenwahl |

4. **Zonensteuerung wählen:** Klicken Sie auf das Auswahlfeld. Es gibt zwei Möglichkeiten:

![Auswahl der Zonensteuerung](img/admin-zonemode-de.png)

| Wahl | Was Sie bekommen | Nehmen Sie diese Wahl, wenn … |
| --- | --- | --- |
| **Zonenwahl (light.zone)** | Einen Satz Datenpunkte `light.*` und einen Datenpunkt `light.zone`, mit dem Sie festlegen, an welche Zone die Befehle gehen | … Sie alle Leuchten meist gemeinsam steuern oder unsicher sind. **Empfohlen.** |
| **Ein Kanal je Zone** | Zusätzlich die Ordner `zones.zone1` bis `zones.zone8` mit eigenen Datenpunkten je Zone | … Sie in Skripten oder Visualisierungen einzelne Zonen direkt ansprechen möchten |

Kapitel 10 erklärt beide Varianten mit Beispielen.

5. Klicken Sie unten auf **Speichern und schließen**. Die Instanz startet und verbindet sich mit dem Gateway.

> [!TIP]
> **IP-Adresse unbekannt?** Tragen Sie Geräte-ID und Local Key ein, klicken Sie auf **Speichern** (nicht schließen) und dann auf **Gateway im lokalen Netzwerk suchen**. Die Suche dauert bis zu 12 Sekunden. Findet sie das Gateway, trägt sie IP-Adresse und Protokollversion selbst ein – danach noch einmal **Speichern und schließen**. Der Knopf funktioniert nur, wenn die Instanz läuft.

> [!IMPORTANT]
> Wenn Sie die **Zonensteuerung** später ändern, löscht der Adapter die Datenpunkte der anderen Variante. Skripte, die diese Datenpunkte benutzen, müssen Sie dann anpassen.

## 8. Schritt 5 – Prüfen, ob alles funktioniert

1. **Instanz-Status:** Klicken Sie links auf **Instanzen**. Das Symbol am Anfang der Zeile **miboxer-wl433.0** zeigt den Zustand – so wie bei allen ioBroker-Adaptern:
   - **grün:** läuft und ist mit dem Gateway verbunden – alles in Ordnung;
   - **gelb:** läuft, ist aber (noch) nicht verbunden – kurz warten, sonst Kapitel 12;
   - **rot:** gestoppt – mit dem Start-Knopf (Dreieck) starten.
2. **Datenpunkte ansehen:** Klicken Sie links auf **Objekte** und öffnen Sie nacheinander die Ordner **miboxer-wl433 → 0 → light** (auf das Ordnersymbol klicken). Die Werte sollten zu dem passen, was die MiBoxer-App anzeigt:

![Datenpunkte unter miboxer-wl433.0.light](img/admin-objects-light-de.png)

3. **Verbindung prüfen:** Im Ordner **info** muss der Datenpunkt **connection** auf `true` stehen.
4. **Erster Schalttest:** Klicken Sie in der Zeile **brightness** auf den Wert, tippen Sie `50` ein und drücken Sie Enter. Nach etwa **2 bis 3 Sekunden** zeigt auch die App 50 % Helligkeit.

> [!NOTE]
> **Warum dauert das 2 bis 3 Sekunden?** Das Gateway meldet seinen neuen Zustand erst etwa 2,5 Sekunden nach der letzten Änderung. Erst dann „bestätigt“ der Adapter den Wert. Bis dahin zeigt Admin den eingegebenen Wert als noch nicht bestätigt an.

Wenn etwas nicht klappt, lesen Sie in Kapitel 12 weiter.

## 9. Die Poolbeleuchtung bedienen

### 9.1 Einen Wert ändern

Im Reiter **Objekte** ändern Sie einen Wert so:

1. Klicken Sie in der Spalte **Wert** auf den Wert des Datenpunkts.
2. Geben Sie den neuen Wert ein oder wählen Sie ihn aus. Schalter (wie **on**) klicken Sie einfach an, Knöpfe (wie **speedUp**) ebenso.
3. Bestätigen Sie mit Enter bzw. **Übernehmen**.

In Skripten, Visualisierungen oder Sprachassistenten benutzen Sie dieselben Datenpunkte – nur eben automatisch (Kapitel 11).

### 9.2 Was möchten Sie tun?

Alle Datenpunkte liegen im Ordner `miboxer-wl433.0.light`:

| Sie möchten … | Datenpunkt | Wert (Beispiel) |
| --- | --- | --- |
| einschalten | `light.on` | `true` (Schalter an) |
| ausschalten | `light.on` | `false` (Schalter aus) – oder `light.brightness` auf `0` |
| heller oder dunkler | `light.brightness` | `1` bis `100` (Prozent) |
| warmweißes Licht | `light.colorTemperature` | `2700` |
| neutralweißes Licht | `light.colorTemperature` | `4500` |
| kaltweißes Licht | `light.colorTemperature` | `6500` |
| eine Farbe | `light.color` | `#0000ff` (blau) – oder `light.hue` mit einer Gradzahl |
| eine blassere Farbe | `light.saturation` | `0` (weiß) bis `100` (kräftig) |
| ein Farbprogramm starten | `light.scene` | `1` bis `9` (M1–M9 in der App) |
| Farbprogramm schneller | `light.speedUp` | Knopf drücken |
| Farbprogramm langsamer | `light.speedDown` | Knopf drücken |
| zurück zu weißem Licht | `light.mode` | `white` |
| zurück zur letzten Farbe | `light.mode` | `colour` |
| automatisch nach einer Zeit umschalten | `light.countdown` | Sekunden, z. B. `3600` für eine Stunde |

### 9.3 Farben

Farben stellen Sie am einfachsten über `light.color` im Format `#RRGGBB` ein oder über `light.hue` als Winkel auf dem Farbkreis:

| Farbe | `light.hue` | `light.color` |
| --- | --- | --- |
| Rot | `0` | `#ff0000` |
| Orange | `30` | `#ff8000` |
| Gelb | `60` | `#ffff00` |
| Grün | `120` | `#00ff00` |
| Türkis | `180` | `#00ffff` |
| Blau | `240` | `#0000ff` |
| Violett | `270` | `#8000ff` |
| Pink | `300` | `#ff00ff` |

Die **Helligkeit** stellen Sie immer getrennt mit `light.brightness` ein. Ein dunkler RGB-Wert wie `#800000` ergibt deshalb **kräftiges Rot in der aktuellen Helligkeit** – nicht ein dunkles Rot.

### 9.4 Was der Adapter automatisch erledigt

- **Einschalten bei Bedarf:** Stellen Sie Helligkeit, Farbe, Weißton oder ein Programm ein, während das Licht aus ist, schaltet der Adapter es zuerst ein – genau wie die App.
- **Moduswechsel:** Eine Farbtemperatur schaltet automatisch auf weißes Licht, eine Farbe auf Farblicht.
- **Schieberegler:** Ändern Sie einen Wert sehr schnell hintereinander (etwa mit einem Schieberegler), sendet der Adapter nur den letzten Wert.
- **Bestätigung:** Jeder Befehl gilt erst als ausgeführt, wenn das Gateway den neuen Zustand meldet (nach etwa 2,5 Sekunden). Bleibt die Meldung aus, fragt der Adapter nach und schreibt eine Warnung ins Protokoll (Kapitel 12).
- **Abgleich mit der App:** Was Sie in der MiBoxer-App ändern, erscheint auch in ioBroker. Zusätzlich fragt der Adapter den Zustand regelmäßig ab (Einstellung *Intervall für die Statusabfrage*).

## 10. Zonen

Das Gateway kann bis zu **8 Zonen** getrennt steuern (Zone 1 bis 8) oder alle gemeinsam („ALL“). Welche Leuchte zu welcher Zone gehört, haben Sie in Kapitel 4 in der App festgelegt.

> [!IMPORTANT]
> Das Gateway meldet **nur einen Zustand für alle Leuchten** – den der letzten Einstellung, egal an welche Zone sie ging. Stellen Sie Zone 1 auf Rot und danach Zone 2 auf Blau, zeigt `light.*` „Blau“, obwohl die Leuchten in Zone 1 weiter rot leuchten. Das ist eine Eigenschaft des Gateways: Auch die MiBoxer-App zeigt keinen Unterschied zwischen den Zonen.

### 10.1 Variante „Zonenwahl“ (Standard)

Mit dem Datenpunkt `light.zone` legen Sie fest, wohin die Befehle von `light.*` gehen:

| `light.zone` | Befehle gehen an |
| --- | --- |
| `0` | alle Zonen |
| `1` bis `8` | nur diese Zone |

**Beispiel – nur die Leuchten in Zone 2 sollen blau leuchten:**

1. `light.zone` auf `2` stellen.
2. `light.color` auf `#0000ff` stellen.
3. Danach `light.zone` wieder auf `0` stellen, damit spätere Befehle wieder an alle Zonen gehen.

> [!TIP]
> `light.zone` bleibt eingestellt, bis Sie es ändern – auch nach einem Neustart. Stellen Sie es nach gezielten Befehlen an eine Zone am besten wieder auf `0`.

### 10.2 Variante „Ein Kanal je Zone“

Hier gibt es zusätzlich den Ordner `zones` mit je einem Unterordner `zone1` bis `zone8`. Jeder hat dieselben Datenpunkte wie `light` (on, brightness, colorTemperature, color, hue, saturation, mode, scene, speedUp, speedDown). `light.*` sendet in dieser Variante immer an **alle** Zonen.

**Beispiel – nur Zone 2 blau:** `zones.zone2.color` auf `#0000ff` stellen. Fertig.

![Zonenkanal zone2: nur die bestätigten Werte sind gefüllt](img/admin-objects-zones-de.png)

> [!NOTE]
> Ein Zonenkanal zeigt die **zuletzt an diese Zone gesendeten und vom Gateway bestätigten** Werte. Felder bleiben leer, bis Sie etwas an die Zone geschickt haben. Im Bild wurden an Zone 2 nur „Ein“ und „Helligkeit 40 %“ gesendet. Ein Befehl über `light.*` (alle Zonen) trägt seinen Wert in allen acht Zonenkanälen ein.

## 11. Beispiele für Automatisierungen

### 11.1 Mit Skripten (JavaScript-Adapter)

Installieren Sie dazu den Adapter **JavaScript/Blockly** (Reiter **Adapter**, Suche `javascript`). Legen Sie unter **Skripte** ein neues JavaScript an und fügen Sie ein:

```javascript
// Bei Sonnenuntergang: Poolbeleuchtung blau mit 60 % Helligkeit einschalten
schedule({ astro: "sunset" }, async () => {
    await setStateAsync("miboxer-wl433.0.light.color", "#0000ff");
    await setStateAsync("miboxer-wl433.0.light.brightness", 60);
});

// Um 23:00 Uhr ausschalten
schedule("0 23 * * *", async () => {
    await setStateAsync("miboxer-wl433.0.light.on", false);
});
```

**Nur eine Zone schalten – Variante „Zonenwahl“:**

```javascript
// Zone 2 auf Farbprogramm M3, danach wieder alle Zonen ansprechen
await setStateAsync("miboxer-wl433.0.light.zone", 2);
await setStateAsync("miboxer-wl433.0.light.scene", 3);
await setStateAsync("miboxer-wl433.0.light.zone", 0);
```

**Nur eine Zone schalten – Variante „Ein Kanal je Zone“:**

```javascript
await setStateAsync("miboxer-wl433.0.zones.zone2.scene", 3);
```

### 11.2 Mit Blockly (ohne Programmieren)

Blockly ist im Adapter **JavaScript/Blockly** enthalten. Sie setzen dabei Bausteine zusammen: **(ungeprüft)**

1. Unter **Skripte** ein neues **Blockly**-Skript anlegen.
2. Aus der Gruppe **Zeitplan** einen Auslöser wählen, zum Beispiel **Astro** mit *Sonnenuntergang*.
3. Aus der Gruppe **System** den Baustein **steuere** hineinziehen, die Objekt-ID `miboxer-wl433.0.light.color` auswählen und als Wert `#0000ff` eintragen.
4. Speichern und das Skript starten.

### 11.3 Visualisierung und Sprachassistenten

Die Datenpunkte haben die in ioBroker üblichen „Rollen“ (zum Beispiel *Schalter Licht*, *Dimmer*, *Farbe RGB*, *Farbtemperatur*). Visualisierungen und Adapter für Sprachassistenten können die Poolbeleuchtung deshalb meist automatisch als Lampe erkennen. **(ungeprüft)**

## 12. Fehlersuche

### 12.1 Ausführliches Protokoll einschalten

Für die Fehlersuche schreibt der Adapter auf Wunsch jeden Schritt ins Protokoll:

1. Öffnen Sie die Einstellungen der Instanz (Kapitel 7, Schraubenschlüssel).
2. Oben neben dem Namen steht die **Protokollstufe** (zum Beispiel `info`). Klicken Sie auf den **Stift** daneben und wählen Sie `debug`.
3. Den Stift finden Sie auch im Bild in Kapitel 7 oben rechts neben *v0.1.0*.

Das Protokoll sehen Sie links unter **Protokolle**. Tippen Sie oben in das Filterfeld `miboxer`, um nur die Meldungen dieses Adapters zu sehen. Jede Meldung beginnt mit einer Kennung in eckigen Klammern, zum Beispiel `[conn]` für die Verbindung oder `[cmd]` für Befehle.

> [!TIP]
> Stellen Sie die Stufe nach der Fehlersuche wieder auf `info`. Die Stufe `debug` erzeugt sehr viele Zeilen.

### 12.2 Meldungen und was Sie tun können

| Meldung im Protokoll (Anfang) | Bedeutung | Was Sie tun können |
| --- | --- | --- |
| `[cfg] Adapter is not configured: please enter the device ID and the local key …` | Geräte-ID oder Local Key fehlen | Kapitel 7: beide Felder ausfüllen |
| `[cfg] The local key must have exactly 16 characters …` | Der Local Key ist zu kurz oder zu lang | Schlüssel genau abschreiben (16 Zeichen, keine Leerzeichen) |
| `[conn] Cannot keep a connection to the WL-433 gateway …` | Das Gateway lässt den Adapter nicht zu | IP-Adresse, Local Key und Protokollversion prüfen; MiBoxer-App auf allen Handys schließen; andere Tuya-Integrationen (ioBroker.tuya, Home Assistant) für dieses Gateway abschalten |
| `[rx] Gateway sent data that could not be decoded …` | Der Local Key ist falsch oder veraltet (Gateway neu gekoppelt) | Kapitel 5 wiederholen und den neuen Local Key eintragen |
| `[disc] Gateway … did not announce itself in the local network …` | Die automatische Suche hat das Gateway nicht gefunden | IP-Adresse aus dem Router ablesen und eintragen; Gateway und ioBroker müssen im selben Netz sein |
| `[cmd] #12 light.brightness: the gateway did not confirm …` | Das Gateway hat nach einem Befehl keinen passenden Zustand gemeldet | Ist das Gateway eingeschaltet und im WLAN? In der App prüfen, ob es erreichbar ist. Tritt es öfter auf: Problem melden (12.4) |
| `[poll] … Status query not answered …` | Das Gateway antwortet nicht auf die Zustandsabfrage | Prüfen, ob es wirklich ein WL-433 ist; Problem melden (12.4) |
| `[cmd] … not executed: a colour like "#ff8800" is expected` | Der eingegebene Wert hat das falsche Format | Farbe im Format `#RRGGBB` eingeben |
| `[cmd] … not executed: gateway is not connected` | Der Befehl kam, während keine Verbindung bestand | Warten, bis `info.connection` wieder `true` ist, und den Befehl wiederholen |
| `[dp101] Status frame … has an unknown mode …` | Das Gateway meldet einen unbekannten Zustand | Problem melden (12.4) |
| `[cfg] light.mode is created again without the mode "music" …` | Einmalige Umstellung beim Update von Version 0.0.1 | Nichts – eigene Einstellungen dieses Datenpunkts (z. B. Verlauf) ggf. neu setzen |
| `[cfg] Zone mode "…": removed …` | Nach einer Änderung der Zonensteuerung wurden die Datenpunkte der anderen Variante gelöscht | Nichts – ggf. Skripte anpassen |

### 12.3 Häufige Fragen

**Alle Zonen zeigen dieselbe Farbe, obwohl die Leuchten verschieden leuchten.**
Das ist richtig so: Das Gateway meldet nur einen Zustand für alle Leuchten (Kapitel 10).

**Ein Wert springt nach dem Ändern kurz zurück oder wird erst nach 2 bis 3 Sekunden übernommen.**
Das Gateway meldet seinen Zustand etwa 2,5 Sekunden nach der letzten Änderung. Erst dann übernimmt der Adapter den Wert endgültig.

**Nach dem erneuten Koppeln des Gateways in der App funktioniert nichts mehr.**
Der Local Key hat sich geändert. Lesen Sie ihn neu aus (Kapitel 5) und tragen Sie ihn ein (Kapitel 7).

**Die IP-Adresse des Gateways hat sich geändert.**
Lassen Sie das Feld **IP-Adresse des Gateways** leer – dann sucht der Adapter das Gateway selbst. Besser noch: eine DHCP-Reservierung im Router einrichten (Kapitel 3).

**Die Geschwindigkeit des Farbprogramms wird nirgends angezeigt.**
Das Gateway meldet sie nicht. `speedUp` und `speedDown` wirken trotzdem.

**Der Adapter meldet Erfolg, aber eine Leuchte reagiert nicht.**
Der Adapter sieht nur das Gateway, nicht die Leuchten. Prüfen Sie, ob die Leuchte mit einer Zone verknüpft ist und ob sie in der App reagiert. Leuchten im Wasser haben eine kürzere Funkreichweite.

### 12.4 Ein Problem melden

Öffnen Sie ein „Issue“ auf GitHub: <https://github.com/ssbingo/ioBroker.miboxer-wl433/issues>. Hilfreich sind:

1. die Adapter-Version (steht in den Instanz-Einstellungen oben, z. B. *v0.1.0*);
2. ein Protokoll in der Stufe **debug** – vom Start der Instanz bis zum Fehler (12.1);
3. der Inhalt des Datenpunkts `dp101.history` (im Objekte-Reiter unter `miboxer-wl433.0.dp101` anklicken und kopieren);
4. eine kurze Beschreibung, was Sie getan haben und was passiert ist.

> [!NOTE]
> Der Adapter schreibt den Local Key **nie** ins Protokoll – im Protokoll steht nur seine Länge. Sie können das Protokoll also bedenkenlos anhängen. Hängen Sie aber **keine** Mitschnitte der MiBoxer-App an (Kapitel 5), denn die enthalten den Schlüssel.

## 13. Für Neugierige: So funktioniert es im Detail

Dieses Kapitel ist für alle, die verstehen oder nachbauen möchten, wie der Adapter mit dem Gateway spricht. Für die Bedienung brauchen Sie es nicht.

### 13.1 Die Verbindung

Das WL-433 enthält ein WLAN-Modul der Firma Tuya. Der Adapter verbindet sich über das **Tuya-LAN-Protokoll 3.3** (TCP-Port 6668, verschlüsselt mit dem Local Key) mit dem Gateway. Die eigentlichen Licht-, Zonen- und Szenenbefehle stecken im herstellerspezifischen **Datenpunkt 101**: kurze Nachrichten („Frames“) aus 12 Bytes. Das letzte Byte ist eine Prüfsumme – die Summe der ersten 11 Bytes.

### 13.2 Die Befehle

Ein Befehl an das Gateway sieht so aus (Werte in Hexadezimalschreibweise):

```text
41 00 00 0B  cc  vv  vv vv vv  zz  80  ss
             │   │             │       └─ Prüfsumme
             │   │             └─ Zone: 00 = alle, 01–08 = Zone 1–8
             │   └─ Wert
             └─ Befehl
```

| Befehl `cc` | Bedeutung | Wert `vv` |
| --- | --- | --- |
| `01` | Farbton (schaltet auf Farbe) | 0–255 für den ganzen Farbkreis, steht in den Bytes 5 bis 8 |
| `02` | Helligkeit | 1–100 % |
| `03` | Farbtemperatur | 0–38 (2700 K + 100 K je Stufe) |
| `04` | Sättigung | 0–100 % |
| `05` | Farbprogramm | 1–9 (M1–M9) |
| `06` | Taste | `01` ein, `02` aus, `03` langsamer (S-), `04` schneller (S+), `06` weißes Licht |

Die Abfrage `43 00 00 80 00 00 00 00 00 80 80 C3` beantwortet das Gateway mit seinem Zustand:

```text
42|44 00 00 00  mm  hh  tt  bb  ss  0B 01  xx
                │   │   │   │   └─ Sättigung (im Weißmodus 0)
                │   │   │   └─ Helligkeit
                │   │   └─ Farbtemperatur-Stufe
                │   └─ Farbton
                └─ Modus: 00 aus, 01 Farbe, 02 Weiß, 03–0B Programm M1–M9
```

`42` meldet eine Änderung (etwa 2,5 Sekunden nach der letzten Änderung), `44` ist die Antwort auf die Abfrage.

### 13.3 Das Protokoll selbst nachvollziehen

Das Format wurde am 22.09.2026 so entschlüsselt – Sie können es mit derselben Methode nachprüfen oder für eine neuere Gateway-Firmware erweitern:

1. **Befehle der App mitlesen:** Verbinden Sie ein Android-Gerät wie in Kapitel 5.1 mit dem Computer und starten Sie `adb logcat -v time > befehle.txt`. Die MiBoxer-App schreibt jeden Befehl als Zeile `ayxsendData =<Hex-Werte>` ins Protokoll.
2. **Genau eine Aktion pro Schritt:** Führen Sie in der App genau **eine** Aktion aus (zum Beispiel „Helligkeit auf 50 %“), notieren Sie die Uhrzeit und warten Sie etwa 10 Sekunden bis zur nächsten Aktion.
3. **Befehle finden:** `findstr "ayxsendData" befehle.txt` (Windows) bzw. `grep ayxsendData befehle.txt` (Linux, macOS) listet alle gesendeten Befehle.
4. **Zustände vergleichen:** Der Datenpunkt `dp101.history` des Adapters zeigt dazu die Zustandsmeldungen des Gateways mit Uhrzeit.
5. **Selbst senden:** In `dp101.hex` können Sie 11 Bytes eintragen – der Adapter ergänzt die Prüfsumme und sendet den Frame. Beispiel: `43 00 00 80 00 00 00 00 00 80 80` fragt den Zustand ab.

> [!WARNING]
> Die Datei `befehle.txt` enthält auch den Local Key. Veröffentlichen Sie sie nicht, sondern nur die herausgesuchten `ayxsendData`-Zeilen.

Die vollständige Herleitung mit allen Belegen steht in der Protokollanalyse, Kapitel 3.1.8: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md).

## 14. Begriffe

| Begriff | Erklärung |
| --- | --- |
| **Adapter** | Ein Zusatzprogramm für ioBroker, das ein bestimmtes Gerät oder einen Dienst anbindet |
| **Instanz** | Ein laufender Adapter mit eigenen Einstellungen, z. B. `miboxer-wl433.0` |
| **Datenpunkt / State** | Ein einzelner Wert in ioBroker, z. B. `light.brightness`. Im Reiter **Objekte** zu sehen |
| **Bestätigt (ack)** | Der Wert wurde vom Gerät gemeldet oder bestätigt – nicht nur eingegeben |
| **Gateway** | Das Gerät WL-433, das zwischen WLAN und Funk vermittelt |
| **Zone** | Eine Gruppe von Leuchten, die gemeinsam geschaltet wird (1 bis 8) |
| **Szene / Farbprogramm** | Die Programme M1–M9 der App mit wechselnden Farben |
| **Geräte-ID** | Die eindeutige Kennung des Gateways bei Tuya |
| **Local Key** | Der geheime 16-stellige Schlüssel für die verschlüsselte Verbindung im Heimnetz |
| **Tuya** | Hersteller des WLAN-Moduls im Gateway und der zugehörigen Cloud |
| **LoRa** | Die Funktechnik, mit der das Gateway die Leuchten erreicht (433 MHz) |
| **Protokoll / Log** | Ein Tagebuch, in das ein Programm schreibt, was es tut |
| **adb** | Ein Werkzeug von Google, mit dem ein Computer auf ein Android-Gerät zugreifen kann |
| **DHCP-Reservierung** | Eine Einstellung im Router, die einem Gerät immer dieselbe IP-Adresse gibt |

## 15. Rechtliches und Kontakt

Dies ist ein **inoffizielles Community-Projekt**. Es steht in keiner Verbindung zur Shenzhen Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) oder zu Tuya. „MiBoxer“, „Mi-Light“ und „Tuya“ sind Marken ihrer jeweiligen Inhaber und werden nur zur Beschreibung der Kompatibilität verwendet. Die Nutzung erfolgt auf eigene Gefahr.

- Quellcode und Fragen: <https://github.com/ssbingo/ioBroker.miboxer-wl433>
- Lizenz: MIT – Copyright (c) 2026 ssbingo
