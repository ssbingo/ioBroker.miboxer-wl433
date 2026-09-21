# ioBroker.miboxer-wl433

> [English README](../../README.md)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

Pilotage local des projecteurs de piscine LoRa **MiBoxer PW01 / PW02** (433 MHz) via la passerelle **MiBoxer WL-433** — sans cloud, sans assistant vocal, directement sur votre réseau local.

Fabricant: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — [WL-433](https://miboxer.com/product/lora-433mhz-gateway), [PW01](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz)

## Avertissement

Il s'agit d'un **projet communautaire non officiel**. Il **n'est ni affilié, ni soutenu, ni approuvé** par Shenzhen Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) ou Tuya. « MiBoxer », « Mi-Light » et « Tuya » sont des marques de leurs propriétaires respectifs et ne sont utilisées que pour décrire la compatibilité des appareils. Utilisation à vos propres risques.

## Fonctionnement

Le WL-433 contient un module Wi-Fi Tuya. Sur le réseau local, la passerelle est **un seul** appareil Tuya — toutes les lampes associées sont pilotées via cet appareil, la passerelle transmet les commandes aux lampes par LoRa (433 MHz). L'adaptateur communique directement avec la passerelle via le **protocole LAN Tuya 3.3** (port TCP 6668, chiffré en AES avec la clé locale), en s'appuyant sur la bibliothèque éprouvée [tuyapi](https://github.com/codetheweb/tuyapi) (également utilisée par ioBroker.tuya). Les versions de protocole 3.1, 3.4 et 3.5 sont aussi prises en charge, au cas où une mise à jour du firmware les modifierait.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

La recherche de fond (analyse du protocole, sources, plan de test) est disponible en allemand : [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Guide pour associer les lampes à la passerelle : [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Matériel pris en charge

| Appareil | Rôle | Statut |
| --- | --- | --- |
| MiBoxer WL-433 | Obligatoire, l'adaptateur s'y connecte | Protocole Tuya 3.3 confirmé par un utilisateur disposant du même matériel |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lampe associée à la passerelle | Appareil cible |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lampe associée à la passerelle | Même famille de produits, devrait fonctionner |
| MiBoxer UW01, UW02, UW03, RD-9L | Lampe associée à la passerelle | Non testé |

## Prérequis

1. La passerelle est configurée dans l'application MiBoxer et les lampes y sont associées.
2. **ID de l'appareil et clé locale** de la passerelle. Le fabricant ne prend pas en charge la plateforme développeur Tuya pour le WL-433, mais l'application MiBoxer écrit les deux valeurs dans son journal de débogage : sous Android, lisez le journal avec une visionneuse logcat comme *LogFox* pendant que l'application démarre et pilote la passerelle. **La clé locale change à chaque nouvel appairage de la passerelle** — elle doit alors être relue et saisie à nouveau.
3. La passerelle est joignable depuis ioBroker (même réseau). Une réservation DHCP est recommandée ; sans adresse IP configurée, l'adaptateur trouve la passerelle grâce à ses diffusions UDP (ports 6666/6667).
4. **Les appareils Tuya n'acceptent qu'une seule connexion locale.** Fermez l'application MiBoxer sur les téléphones du même réseau et ne pilotez pas la passerelle en même temps avec d'autres intégrations locales (ioBroker.tuya, Home Assistant, tinytuya).

## Configuration

| Paramètre | Description |
| --- | --- |
| ID de l'appareil | ID Tuya de la passerelle WL-433 |
| Clé locale | Clé locale Tuya de 16 caractères (stockée chiffrée) |
| Adresse IP de la passerelle | Laisser vide pour trouver la passerelle automatiquement sur le réseau local |
| Version du protocole Tuya | 3.3 pour le WL-433 (3.1, 3.4 et 3.5 sélectionnables) |
| Rechercher la passerelle sur le réseau local | Bouton : trouve la passerelle grâce à son ID et renseigne l'adresse IP et la version du protocole. Sans ID, tous les appareils Tuya trouvés sont listés |
| Délai de reconnexion | Secondes avant une nouvelle tentative de connexion (30 par défaut) |
| Intervalle d'actualisation de l'état | Secondes entre deux requêtes d'état complètes (60 par défaut, 0 = uniquement les mises à jour envoyées par la passerelle) |

## États

| State | Tuya DP | Description |
| --- | --- | --- |
| `info.connection` | – | Connexion à la passerelle |
| `info.ip` | – | Adresse IP utilisée pour la passerelle |
| `light.on` | 20 | Allumer/éteindre toutes les lampes |
| `light.mode` | 21 | `white`, `colour`, `scene`, `music` |
| `light.brightness` | 22 / 24 | Luminosité 0–100 %. En mode couleur, la luminosité de la couleur (DP 24) est modifiée, sinon la luminosité du blanc (DP 22). 0 éteint, une valeur supérieure à 0 allume |
| `light.colorTemperature` | 23 | Température de couleur 2700–6500 K (passe en mode blanc) |
| `light.color` | 24 | Couleur au format `#rrggbb` (passe en mode couleur) |
| `light.countdown` | 26 | Secondes avant que la passerelle ne bascule les lampes (0 = désactivé) |
| `dp101.raw` | 101 | Dernière trame DP 101 en Base64 — l'écriture envoie la valeur telle quelle |
| `dp101.hex` | 101 | Dernière trame DP 101 en octets hexadécimaux — l'écriture envoie la trame, la somme de contrôle est ajoutée ou corrigée automatiquement |
| `dp101.checksumValid` | 101 | La somme de contrôle de la dernière trame est valide |
| `dp101.history` | 101 | Liste JSON des 50 dernières trames (`rx` = reçue, `tx` = envoyée) avec horodatage |
| `raw.dp<n>` | n | Tout autre point de données signalé par la passerelle est créé automatiquement (modifiable) |

Les changements rapides (p. ex. d'un curseur) sont regroupés en une seule commande. Les commandes ne sont acceptées que lorsque la passerelle est connectée.

## Point de données 101 — zones et scènes

Le WL-433 transmet les commandes de zones et de scènes dans le point de données 101 spécifique au fabricant : trames binaires de 12 octets, encodées en Base64, dont le dernier octet est la somme sur 8 bits des octets 0–10. La signification des autres octets **n'est pas encore décodée**. En attendant, l'adaptateur offre un accès brut :

- les trames reçues apparaissent dans `dp101.raw` / `dp101.hex` et sont enregistrées dans `dp101.history`,
- des trames peuvent être envoyées via `dp101.hex` — 11 octets suffisent, la somme de contrôle est ajoutée automatiquement, p. ex. `43 00 00 80 00 00 00 00 00 80 80`

**Aide bienvenue :** effectuez une seule action à la fois dans l'application MiBoxer (par zone : allumer, éteindre, couleur, scène 1–9) et notez les trames de `dp101.history`. Avec suffisamment d'enregistrements, les trames pourront être décodées et des états dédiés aux zones et aux scènes ajoutés. La procédure est décrite au chapitre 6 de l'analyse du protocole.

## Limites

- Les points de données standard 20–26 agissent sur toutes les lampes de la passerelle (éventuellement uniquement sur la zone sélectionnée dans l'application). Les zones et scènes séparées suivront dès que le point de données 101 sera décodé.
- La passerelle continue de signaler son état au cloud Tuya. Bloquer complètement son accès à internet peut la rendre peu fiable.
- Cette première version a été testée avec une simulation de la passerelle (protocole Tuya 3.3). Les retours avec du matériel réel sont les bienvenus.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) Première version : pilotage local de la passerelle WL-433 via le protocole LAN Tuya (marche/arrêt, mode, luminosité, température de couleur, couleur, compte à rebours), accès brut au point de données 101 avec gestion de la somme de contrôle et recherche de la passerelle sur le réseau local

## Licence

Licence MIT — Copyright (c) 2026 ssbingo. Le texte complet de la licence figure dans le [English README](../../README.md#license) et dans le fichier [LICENSE](../../LICENSE).
