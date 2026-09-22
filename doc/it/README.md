# ioBroker.miboxer-wl433

> [English README](../../README.md)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

Controllo locale delle luci per piscina LoRa **MiBoxer PW01 / PW02** (433 MHz) tramite il gateway **MiBoxer WL-433** — senza cloud, senza assistente vocale, direttamente nella tua rete locale.

Produttore: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — [WL-433](https://miboxer.com/product/lora-433mhz-gateway), [PW01](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz)

## Esclusione di responsabilità

Questo è un **progetto comunitario non ufficiale**. **Non è affiliato, supportato né approvato** da Shenzhen Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) o da Tuya. «MiBoxer», «Mi-Light» e «Tuya» sono marchi dei rispettivi proprietari e sono usati solo per descrivere la compatibilità dei dispositivi. L'uso avviene a proprio rischio.

## Funzionamento

Il WL-433 contiene un modulo Wi-Fi Tuya. Nella rete locale il gateway è **un unico** dispositivo Tuya: tutte le lampade collegate vengono controllate tramite questo dispositivo e il gateway inoltra i comandi via LoRa (433 MHz) alle lampade. L'adattatore parla direttamente il **protocollo LAN Tuya 3.3** (porta TCP 6668, cifratura AES con la chiave locale) con il gateway, basandosi sulla collaudata libreria [tuyapi](https://github.com/codetheweb/tuyapi) (usata anche da ioBroker.tuya). Sono supportate anche le versioni di protocollo 3.1, 3.4 e 3.5, nel caso un aggiornamento del firmware la cambi.

Lampade, zone e scene vengono controllate con i comandi propri del gateway nel **punto dati 101** specifico del produttore, gli stessi comandi che invia l'app MiBoxer. Il gateway comunica il suo stato nello stesso modo; l'adattatore lo richiede inoltre alla connessione e a ogni aggiornamento dello stato.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

**Manuale** con ogni passo spiegato per i principianti (installazione, impostazioni, zone, timer, esempi, risoluzione dei problemi): [English](../Manual_miboxer-wl433.md) ([PDF](../Manual_miboxer-wl433.pdf)) · [Deutsch](../Handbuch_miboxer-wl433.md) ([PDF](../Handbuch_miboxer-wl433.pdf)).

Ricerca di base (analisi del protocollo, fonti, piano di prova, punto dati 101 decodificato), in tedesco: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Guida per collegare le lampade al gateway: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Hardware supportato

| Dispositivo | Ruolo | Stato |
| --- | --- | --- |
| MiBoxer WL-433 | Necessario, l'adattatore vi si collega | Testato con un gateway reale (protocollo Tuya 3.3, punto dati 101) |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lampada collegata al gateway | Dispositivo di destinazione |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lampada collegata al gateway | Stessa famiglia di prodotti, dovrebbe funzionare |
| MiBoxer UW01, UW02, UW03, RD-9L | Lampada collegata al gateway | Non testato |

## Requisiti

1. Il gateway è configurato nell'app MiBoxer e le lampade sono collegate ad esso.
2. **ID dispositivo e chiave locale** del gateway. Il produttore non supporta la piattaforma per sviluppatori Tuya per il WL-433, ma l'app MiBoxer scrive entrambi i valori nel suo log di debug: su Android leggete il log con un visualizzatore logcat come *LogFox* mentre l'app si avvia e controlla il gateway. **La chiave locale cambia a ogni nuovo abbinamento del gateway**: allora va riletta e inserita di nuovo. Guida passo passo per principianti (in tedesco, per Android, iPhone e iPad): [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](../Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](../Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. Il gateway è raggiungibile da ioBroker (stessa rete). Si consiglia una prenotazione DHCP; senza indirizzo IP configurato l'adattatore trova il gateway tramite le sue trasmissioni UDP (porte 6666/6667).
4. **I dispositivi Tuya di solito accettano una sola connessione locale.** In una prova l'app MiBoxer e l'adattatore erano collegati contemporaneamente; ma se la connessione continua a fallire, chiudete l'app sugli smartphone della stessa rete e non controllate il gateway contemporaneamente con altre integrazioni locali (ioBroker.tuya, Home Assistant, tinytuya).

## Configurazione

Le impostazioni dell'istanza hanno due schede: **Gateway** (connessione e controllo delle zone) e **Timer** (vedere [Timer](#timer)).

| Impostazione | Descrizione |
| --- | --- |
| ID dispositivo | ID dispositivo Tuya del gateway WL-433 |
| Chiave locale | Chiave locale Tuya di 16 caratteri (memorizzata cifrata) |
| Indirizzo IP del gateway | Lasciare vuoto per trovare automaticamente il gateway nella rete locale |
| Versione del protocollo Tuya | 3.3 per il WL-433 (selezionabili 3.1, 3.4 e 3.5) |
| Cerca il gateway nella rete locale | Pulsante: trova il gateway tramite l'ID dispositivo e inserisce indirizzo IP e versione del protocollo. Senza ID dispositivo vengono elencati tutti i dispositivi Tuya trovati |
| Attesa prima della riconnessione | Secondi prima di ritentare una connessione persa o fallita (predefinito 30) |
| Intervallo di aggiornamento dello stato | Secondi tra le richieste di stato complete (predefinito 60, 0 = solo gli aggiornamenti inviati dal gateway) |
| Controllo delle zone | *Selettore di zona* (predefinito) o *un canale per zona*, vedere [Zone](#zone) |

## Zone

Il gateway controlla fino a 8 zone (come il telecomando FUT086). Ogni comando può andare a una zona o a tutte, ma il gateway comunica **un solo stato per tutte le lampade: l'ultima impostazione, a qualunque zona sia stata inviata**. Nemmeno l'app MiBoxer mostra uno stato separato per zona. L'impostazione *Controllo delle zone* offre due varianti:

| Variante | Stati | Adatto per |
| --- | --- | --- |
| **Selettore di zona (predefinito)** | `light.*` mostra lo stato del gateway. `light.zone` (0 = tutte le zone, 1–8) seleziona la zona a cui vengono inviati i comandi di `light.*`. | La maggior parte degli utenti: ogni stato mostra ciò che il gateway comunica |
| **Un canale per zona** | `light.*` mostra lo stato del gateway e invia a tutte le zone. Inoltre `zones.zone1` … `zones.zone8` controllano ogni zona separatamente. Un canale di zona mostra gli ultimi valori inviati a questa zona e confermati dal gateway; resta vuoto finché non viene inviato qualcosa alla zona. | Script e visualizzazioni che indirizzano direttamente le zone |

Se l'impostazione viene modificata, gli stati dell'altra variante vengono eliminati.

## Timer

La scheda **Timer** delle impostazioni dell'istanza contiene fino a **50 timer**. Funzionano localmente nell'adattatore, anche senza Internet, e possono fare più dei timer dell'app MiBoxer: eventi solari con scostamento, scostamento casuale, stagione, zone, colori, scene e spegnimento dopo una durata. Aggiungete un timer con **+**, apritelo per modificarlo, copiatelo o eliminatelo con i pulsanti della voce. Le modifiche hanno effetto al salvataggio delle impostazioni (l'istanza si riavvia).

| Campo | Descrizione |
| --- | --- |
| Attivo | Disattiva questo timer senza eliminarlo |
| Nome | Mostrato nel log e in `timers.overview` |
| Attivazione | *Ora del giorno* o un evento solare: alba, alba del sole, ora d'oro (sera), tramonto, crepuscolo, notte |
| Ora del giorno | Solo per l'attivazione *Ora del giorno* |
| Scostamento | Minuti (da −720 a 720), negativo = prima; ad es. tramonto −15 |
| Scostamento casuale | Fino a ± minuti (0–120), estratto di nuovo a ogni esecuzione: per una simulazione di presenza |
| Giorni della settimana | Giorni in cui il timer viene eseguito |
| Stagione dal / al | `DD.MM.`, ad es. dal `01.05.` al `30.09.`; funziona anche una stagione a cavallo del nuovo anno (dal `01.11.` al `28.02.`); vuoto = tutto l'anno |
| Zona | Tutte le zone o zona 1–8 |
| Azione | Accendere, spegnere, luce bianca (temperatura colore 2700–6500 K), colore, scena M1–M9, solo luminosità |
| Luminosità | 1–100 %, vuoto = invariata (non per *Spegnere*) |
| Spegnere dopo | Minuti (0–1440), 0 = non spegnere (non per *Spegnere*) |

- Gli **eventi solari** vengono calcolati dalla posizione nelle impostazioni di sistema di ioBroker (latitudine e longitudine) con [suncalc](https://github.com/mourner/suncalc). Senza posizione questi timer vengono ignorati con un avviso. Nei giorni senza l'evento (regioni polari) il timer non viene eseguito.
- Un timer invia gli stessi comandi degli stati: con il controllo delle zone *selettore di zona* alla sua zona (`light.zone` non viene modificato), con *un canale per zona* tramite `zones.zone<n>` (tutte le zone: `light.*`). Il gateway li conferma come ogni comando.
- Se il gateway non è connesso quando un timer è in scadenza, questa esecuzione viene saltata (avviso nel log) e non viene ripetuta in seguito.
- I timer con impostazioni incomplete vengono ignorati; il log e `timers.overview` ne indicano il motivo.
- Gli orari sono orari locali del sistema ioBroker; l'ora legale viene tenuta in considerazione.
- I **timer dell'app MiBoxer** vengono memorizzati ed eseguiti nel cloud Tuya (accendono o spengono solo tutte le zone tramite il punto dati 20 e richiedono Internet). L'adattatore non può leggerli né modificarli, ma ne vede l'effetto nello stato. Entrambi i tipi di timer possono essere usati contemporaneamente.

## Stati

| State | Descrizione |
| --- | --- |
| `info.connection` | Connessione al gateway |
| `info.ip` | Indirizzo IP usato per il gateway |
| `light.on` | Acceso / spento |
| `light.mode` | `white`, `colour` o `scene`: scriverlo cambia modalità (modalità colore con l'ultima tonalità, modalità scena con l'ultima scena) |
| `light.brightness` | Luminosità 1–100 % della modalità attuale. 0 spegne, un valore maggiore di 0 accende |
| `light.colorTemperature` | Temperatura colore 2700–6500 K a passi di 100 K (passa alla modalità bianco) |
| `light.color` | Colore come `#rrggbb` alla massima luminosità (passa alla modalità colore). Scriverlo imposta tonalità e saturazione, la luminosità del valore RGB viene ignorata: usate `light.brightness` |
| `light.hue` | Tonalità 0–360° (passa alla modalità colore) |
| `light.saturation` | Saturazione 0–100 % (passa alla modalità colore) |
| `light.scene` | Scena 1–9 (M1–M9 nell'app), 0 = nessuna scena. Scrivere 1–9 avvia la scena |
| `light.speedUp` / `light.speedDown` | Pulsanti S+ / S- dell'app: scena più veloce / più lenta. Il gateway non comunica la velocità |
| `light.countdown` | Secondi prima che il gateway commuti le lampade (0 = disattivato, punto dati standard 26) |
| `light.zone` | Solo con il selettore di zona: zona dei comandi `light.*`, 0 = tutte le zone, 1–8 |
| `zones.zone<n>.*` | Solo con un canale per zona: `on`, `mode`, `brightness`, `colorTemperature`, `color`, `hue`, `saturation`, `scene`, `speedUp`, `speedDown` per la zona n |
| `dp101.raw` | Ultimo frame del punto dati 101 in Base64: scriverlo invia il valore invariato |
| `dp101.hex` | Ultimo frame del punto dati 101 in byte esadecimali: scriverlo invia il frame, il checksum viene aggiunto o corretto automaticamente |
| `dp101.checksumValid` | Il checksum dell'ultimo frame è valido |
| `dp101.history` | Elenco JSON degli ultimi 50 frame (`rx` = ricevuto, `tx` = inviato) con marca temporale; le risposte di stato identiche ripetute non vengono aggiunte |
| `raw.dp<n>` | Ogni ulteriore punto dati comunicato dal gateway viene creato automaticamente (scrivibile) |
| `settings.dmxAddress` | Indirizzo iniziale 1–512 dell'ingresso DMX512 del gateway – a partire da esso il gateway usa 5 canali: rosso, verde, blu, bianco freddo, bianco caldo (menu *DMX* nell'app). Scriverlo lo invia alla zona di `light.zone` (selettore di zona) o a tutte le zone; il gateway lo conferma |
| `timers.active` | `false` sospende tutti i timer (ad es. durante le vacanze o da uno script), `true` li riattiva |
| `timers.nextRun` | Prossima esecuzione di un timer con il nome del timer (`paused (…)` finché `timers.active` è `false`) |
| `timers.lastRun` | Ultima esecuzione di un timer con nome e azione |
| `timers.overview` | Elenco JSON di tutti i timer: pianificazione, azione, prossima esecuzione, motivo se il timer viene ignorato |

I valori che richiedono una modalità o le lampade accese vengono inviati come fa l'app MiBoxer: ad esempio una temperatura colore in modalità colore passa prima alla modalità bianco, una luminosità con le lampade spente le accende prima. Le modifiche rapide (ad es. da un cursore) vengono raggruppate, viene inviato solo l'ultimo valore. I comandi vengono accettati solo mentre il gateway è connesso. Un comando è considerato eseguito quando lo stato successivo del gateway ne mostra i valori (circa 2,5 s dopo); fino ad allora lo stato non è confermato.

## Punto dati 101 — protocollo

Il WL-433 trasporta lampade, zone e scene nel punto dati 101 specifico del produttore: frame di 12 byte codificati in Base64, l'ultimo byte è la somma a 8 bit dei byte 0–10. Il formato è stato decodificato il 22/09/2026 dai frame di stato di un gateway reale e dai comandi che l'app MiBoxer scrive nel suo log Android:

| Frame | Bytes (hex) | Significato |
| --- | --- | --- |
| Comando (app / adattatore → gateway) | `41 00 00 0B cc vv vv vv vv zz 80 ss` | `cc` comando: `01` tonalità 0–255 (valore nei byte 5–8, passa alla modalità colore), `02` luminosità 1–100 %, `03` temperatura colore 0–38 (2700 K + 100 K per passo), `04` saturazione 0–100 %, `05` scena 1–9, `06` tasto (`01` acceso, `02` spento, `03` S-, `04` S+, `06` modalità bianco); `zz` zona: `00` tutte, `01`–`08` |
| Richiesta di stato | `43 00 00 80 00 00 00 00 00 80 80 C3` | il gateway risponde con un frame di stato `44` |
| Stato (gateway → app) | `42` / `44` `00 00 00 mm hh tt bb ss 0B dd xx` | `42` segnalazione di modifica (circa 2,5 s dopo l'ultima modifica), `44` risposta alla richiesta; `mm` modalità: `00` spento, `01` colore, `02` bianco, `03`–`0B` scena 1–9; `hh` tonalità, `tt` passo della temperatura colore, `bb` luminosità, `ss` saturazione (0 in modalità bianco), `dd` byte basso dell'indirizzo iniziale DMX. La zona non fa parte dello stato |
| Indirizzo iniziale DMX | `49 00 00 0B 02 aa aa 00 00 zz 80 ss` | `aa aa` indirizzo 1–512 (byte alto, byte basso), `zz` zona; risposta `49 00 00 0B 02 01 tt bb ss aa aa xx` |

Anche il tasto `06 05` spegne le lampade (premuto una seconda volta le lascia spente, non funziona come commutatore); cosa faccia di diverso da `06 02` è ancora sconosciuto, l'adattatore non lo usa. Il gateway ricava i punti dati standard 20–23 da questi comandi; l'adattatore usa solo il punto dati 20 (acceso/spento, arriva prima dello stato) e per tutto il resto segue lo stato del punto dati 101. Scrivere il punto dati colore Tuya 24 non cambia il colore delle lampade: nemmeno l'app MiBoxer lo usa.

Accesso diretto per le vostre prove: `dp101.hex` accetta 11 byte (il checksum viene aggiunto), ad es. `43 00 00 80 00 00 00 00 00 80 80` richiede lo stato.

## Limitazioni

- Il gateway comunica un solo stato per tutte le lampade (l'ultima impostazione) e non lo stato di ogni zona: vedere [Zone](#zone).
- Il gateway non comunica la velocità di una scena (S+ / S-).
- Non si può vedere se una lampada ha davvero ricevuto un comando via radio: lo stato proviene dal gateway.
- Il gateway continua a comunicare il suo stato al cloud Tuya. Bloccare completamente il suo accesso a Internet può renderlo inaffidabile. I timer dell'app MiBoxer hanno bisogno del cloud, i timer dell'adattatore no.

## Registrazione e risoluzione dei problemi

L'adattatore registra secondo uno schema fisso, in modo che il log sia sempre utile per individuare gli errori:

| Livello | Cosa viene registrato |
| --- | --- |
| error | Errori di configurazione che impediscono all'adattatore di funzionare (ID dispositivo mancante, chiave locale non di 16 caratteri) |
| warn | Problemi su cui dovete intervenire, segnalati una volta e poi solo a livello debug finché non vengono risolti: il gateway rifiuta le connessioni, dati non decifrabili (chiave locale errata), comandi non confermati dal gateway, richieste di stato senza risposta, valori di punti dati o frame di stato inattesi, timer con impostazioni incomplete o senza posizione per gli eventi solari, timer che non sono riusciti a commutare le lampade, un indirizzo iniziale DMX non confermato dal gateway |
| info | Tappe: riepilogo della configurazione all'avvio, gateway trovato, connesso, connessione persa, connessione di nuovo stabile, oggetti dell'altra variante di zone rimossi, numero di timer attivi, timer sospesi o di nuovo attivi |
| debug | Ogni passo con i suoi input, decisioni e durate: modifica dello stato → traduzione in frame del punto dati 101 (con il motivo di frame aggiuntivi come «prima accendere») → coda dei comandi → invio → conferma tramite lo stato (o quale valore manca ancora), ogni punto dati e stato ricevuto e gli stati aggiornati, richieste di stato, ricerca, ogni timer con la sua pianificazione, la prossima esecuzione (evento solare, scostamento, scostamento casuale) e l'esecuzione. I comandi (`#12`) e i tentativi di connessione (`Attempt #3`) sono numerati, così si possono seguire tutte le righe di un comando |
| silly | In più la traccia del protocollo della libreria tuyapi (pacchetti, ping/pong) con l'etichetta `[tuyapi]` |

Ogni messaggio inizia con un'etichetta del componente: `[cfg]` configurazione, `[conn]` connessione, `[rx]` gateway → stati, `[cmd]` stati → comandi, `[queue]` coda dei comandi, `[poll]` aggiornamento e richiesta di stato, `[disc]` ricerca, `[dp101]` frame grezzi, `[timer]` timer, `[unload]` arresto, `[tuyapi]` traccia della libreria. La chiave locale e le chiavi di sessione non compaiono mai nel log: il riepilogo della configurazione mostra solo la lunghezza della chiave.

Per cambiare il livello: Admin → **Istanze** → modalità esperto → livello di log di `miboxer-wl433.0` → `debug` (o `silly` per la traccia del protocollo; poi riavviate l'istanza). Allegate un log debug e il contenuto di `dp101.history` quando segnalate un problema.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.2.0 (2026-09-22)

- (ssbingo) Timer locali nella nuova scheda *Timer* delle impostazioni dell'istanza (fino a 50): ora del giorno o evento solare con scostamento e scostamento casuale, giorni della settimana, stagione, zona, ogni azione sulle lampade e spegnimento dopo una durata; stati `timers.active`, `timers.nextRun`, `timers.lastRun` e `timers.overview`
- (ssbingo) Indirizzo iniziale dell'ingresso DMX512 del gateway leggibile e scrivibile (`settings.dmxAddress`)
- (ssbingo) Documentati: comando DMX, tasto `06 05`, timer cloud dell'app MiBoxer; manuali con un nuovo capitolo sui timer

### 0.1.0 (2026-09-22)

- (ssbingo) Punto dati 101 decodificato: lampade, zone e scene sono ora controllate con i comandi propri del gateway (prima il colore non si poteva impostare), lo stato viene letto dal punto dati 101 e richiesto attivamente
- (ssbingo) Nuovi stati: tonalità, saturazione, scena M1–M9, pulsanti S+ / S-; zone selezionabili nelle impostazioni come selettore di zona (`light.zone`) o un canale per zona
- (ssbingo) I comandi vengono confermati dallo stato del gateway, viene registrato un avviso se il gateway non li conferma; output debug dettagliato per ogni passo
- (ssbingo) Manuale utente in tedesco e inglese per principianti

### 0.0.1 (2026-09-21)

- (ssbingo) Prima versione: controllo locale del gateway WL-433 tramite il protocollo LAN di Tuya (acceso/spento, modalità, luminosità, temperatura colore, colore, conto alla rovescia), accesso diretto al punto dati 101 con gestione del checksum e ricerca del gateway nella rete locale, registrazione di debug dettagliata con etichette dei componenti, numeri di comando e durate (i segreti non vengono mai registrati)

## Licenza

Licenza MIT — Copyright (c) 2026 ssbingo. Il testo completo della licenza si trova nel [English README](../../README.md#license) e nel file [LICENSE](../../LICENSE).
