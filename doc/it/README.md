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

Il WL-433 contiene un modulo Wi-Fi Tuya. Nella rete locale il gateway è **un unico** dispositivo Tuya — tutte le luci abbinate vengono controllate tramite esso, e il gateway inoltra i comandi alle luci via LoRa (433 MHz). L'adattatore comunica direttamente con il gateway tramite il **protocollo LAN Tuya 3.3** (porta TCP 6668, cifratura AES con la chiave locale), basandosi sulla collaudata libreria [tuyapi](https://github.com/codetheweb/tuyapi) (usata anche da ioBroker.tuya). Sono supportate anche le versioni di protocollo 3.1, 3.4 e 3.5, nel caso un aggiornamento del firmware le modifichi.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

La ricerca di base (analisi del protocollo, fonti, piano di test) è disponibile in tedesco: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Guida per abbinare le luci al gateway: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Hardware supportato

| Dispositivo | Ruolo | Stato |
| --- | --- | --- |
| MiBoxer WL-433 | Necessario, l'adattatore vi si collega | Protocollo Tuya 3.3 confermato da un utente con hardware identico |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Luce abbinata al gateway | Dispositivo di riferimento |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Luce abbinata al gateway | Stessa famiglia di prodotti, dovrebbe funzionare |
| MiBoxer UW01, UW02, UW03, RD-9L | Luce abbinata al gateway | Non testato |

## Requisiti

1. Il gateway è configurato nell'app MiBoxer e le luci sono abbinate ad esso.
2. **ID dispositivo e chiave locale** del gateway. Il produttore non supporta la piattaforma per sviluppatori Tuya per il WL-433, ma l'app MiBoxer scrive entrambi i valori nel suo log di debug: su Android leggere il log con un visualizzatore logcat come *LogFox* mentre l'app si avvia e controlla il gateway. **La chiave locale cambia a ogni nuovo abbinamento del gateway** — in tal caso va letta e inserita di nuovo.
3. Il gateway è raggiungibile da ioBroker (stessa rete). Si consiglia una prenotazione DHCP; senza indirizzo IP configurato, l'adattatore trova il gateway tramite i suoi broadcast UDP (porte 6666/6667).
4. **I dispositivi Tuya accettano una sola connessione locale.** Chiudere l'app MiBoxer sui telefoni della stessa rete e non controllare il gateway contemporaneamente con altre integrazioni locali (ioBroker.tuya, Home Assistant, tinytuya).

## Configurazione

| Impostazione | Descrizione |
| --- | --- |
| ID dispositivo | ID Tuya del gateway WL-433 |
| Chiave locale | Chiave locale Tuya di 16 caratteri (memorizzata cifrata) |
| Indirizzo IP del gateway | Lasciare vuoto per trovare automaticamente il gateway nella rete locale |
| Versione del protocollo Tuya | 3.3 per il WL-433 (selezionabili 3.1, 3.4 e 3.5) |
| Cerca il gateway nella rete locale | Pulsante: trova il gateway tramite l'ID dispositivo e inserisce indirizzo IP e versione del protocollo. Senza ID elenca tutti i dispositivi Tuya trovati |
| Ritardo di riconnessione | Secondi prima di un nuovo tentativo di connessione (predefinito 30) |
| Intervallo di aggiornamento dello stato | Secondi tra le richieste complete di stato (predefinito 60, 0 = solo aggiornamenti inviati dal gateway) |

## Stati

| State | Tuya DP | Descrizione |
| --- | --- | --- |
| `info.connection` | – | Connessione al gateway |
| `info.ip` | – | Indirizzo IP usato per il gateway |
| `light.on` | 20 | Accendere/spegnere tutte le luci |
| `light.mode` | 21 | `white`, `colour`, `scene`, `music` |
| `light.brightness` | 22 / 24 | Luminosità 0–100 %. In modalità colore cambia la luminosità del colore (DP 24), altrimenti la luminosità del bianco (DP 22). 0 spegne, un valore maggiore di 0 accende |
| `light.colorTemperature` | 23 | Temperatura colore 2700–6500 K (passa alla modalità bianco) |
| `light.color` | 24 | Colore come `#rrggbb` (passa alla modalità colore) |
| `light.countdown` | 26 | Secondi prima che il gateway commuti le luci (0 = disattivato) |
| `dp101.raw` | 101 | Ultimo frame DP 101 in Base64 — la scrittura invia il valore invariato |
| `dp101.hex` | 101 | Ultimo frame DP 101 in byte esadecimali — la scrittura invia il frame, il checksum viene aggiunto o corretto automaticamente |
| `dp101.checksumValid` | 101 | Il checksum dell'ultimo frame è valido |
| `dp101.history` | 101 | Elenco JSON degli ultimi 50 frame (`rx` = ricevuto, `tx` = inviato) con marca temporale |
| `raw.dp<n>` | n | Ogni altro punto dati segnalato dal gateway viene creato automaticamente (scrivibile) |

Le modifiche rapide (ad es. da un cursore) vengono raggruppate in un unico comando. I comandi vengono accettati solo mentre il gateway è connesso.

## Punto dati 101 — zone e scene

Il WL-433 trasmette i comandi di zone e scene nel punto dati 101 specifico del produttore: frame binari di 12 byte, codificati in Base64, in cui l'ultimo byte è la somma a 8 bit dei byte 0–10. Il significato degli altri byte **non è ancora decodificato**. Fino ad allora l'adattatore offre un accesso diretto:

- i frame ricevuti compaiono in `dp101.raw` / `dp101.hex` e vengono registrati in `dp101.history`,
- i frame possono essere inviati tramite `dp101.hex` — bastano 11 byte, il checksum viene aggiunto automaticamente, ad es. `43 00 00 80 00 00 00 00 00 80 80`

**Cercasi aiuto:** eseguire nell'app MiBoxer una sola azione alla volta (per zona: accendi, spegni, colore, scena 1–9) e annotare i frame di `dp101.history`. Con registrazioni sufficienti i frame potranno essere decodificati e aggiunti stati dedicati per zone e scene. La procedura è descritta nel capitolo 6 dell'analisi del protocollo.

## Limitazioni

- I punti dati standard 20–26 agiscono su tutte le luci del gateway (forse solo sulla zona selezionata nell'app). Zone e scene separate seguiranno quando il punto dati 101 sarà decodificato.
- Il gateway continua a comunicare il proprio stato al cloud Tuya. Bloccare completamente l'accesso a internet può renderlo inaffidabile.
- Questa prima versione è stata testata con una simulazione del gateway (protocollo Tuya 3.3). Riscontri con hardware reale sono molto graditi.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) Prima versione: controllo locale del gateway WL-433 tramite il protocollo LAN di Tuya (acceso/spento, modalità, luminosità, temperatura colore, colore, conto alla rovescia), accesso diretto al punto dati 101 con gestione del checksum e ricerca del gateway nella rete locale

## Licenza

Licenza MIT — Copyright (c) 2026 ssbingo. Il testo completo della licenza si trova nel [English README](../../README.md#license) e nel file [LICENSE](../../LICENSE).
