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

Le WL-433 contient un module Wi-Fi Tuya. Sur le réseau local, la passerelle est **un seul** appareil Tuya : toutes les lampes associées sont pilotées par cet appareil, la passerelle transmet les commandes par LoRa (433 MHz) aux lampes. L'adaptateur parle directement le **protocole LAN Tuya 3.3** (port TCP 6668, chiffrement AES avec la clé locale) avec la passerelle, sur la base de la bibliothèque éprouvée [tuyapi](https://github.com/codetheweb/tuyapi) (également utilisée par ioBroker.tuya). Les versions de protocole 3.1, 3.4 et 3.5 sont aussi prises en charge, au cas où une mise à jour du firmware la changerait.

Les lampes, les zones et les scènes sont pilotées avec les commandes propres à la passerelle dans le **point de données 101** spécifique au fabricant — les mêmes commandes que celles de l'application MiBoxer. La passerelle signale son état de la même manière ; l'adaptateur le demande en outre à la connexion et à chaque actualisation de l'état.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

**Manuel** expliquant chaque étape pour les débutants (installation, paramètres, zones, minuteries, exemples, dépannage) : [English](../Manual_miboxer-wl433.md) ([PDF](../Manual_miboxer-wl433.pdf)) · [Deutsch](../Handbuch_miboxer-wl433.md) ([PDF](../Handbuch_miboxer-wl433.pdf)).

Recherche de fond (analyse du protocole, sources, plan de test, point de données 101 décodé), en allemand : [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Guide pour associer les lampes à la passerelle : [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Matériel pris en charge

| Appareil | Rôle | Statut |
| --- | --- | --- |
| MiBoxer WL-433 | Obligatoire, l'adaptateur s'y connecte | Testé avec une vraie passerelle (protocole Tuya 3.3, point de données 101) |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lampe associée à la passerelle | Appareil cible |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lampe associée à la passerelle | Même famille de produits, devrait fonctionner |
| MiBoxer UW01, UW02, UW03, RD-9L | Lampe associée à la passerelle | Non testé |

## Prérequis

1. La passerelle est configurée dans l'application MiBoxer et les lampes y sont associées.
2. **ID d'appareil et clé locale** de la passerelle. Le fabricant ne prend pas en charge la plateforme développeur Tuya pour le WL-433, mais l'application MiBoxer écrit les deux valeurs dans son journal de débogage : sous Android, lisez le journal avec un lecteur logcat comme *LogFox* pendant que l'application démarre et pilote la passerelle. **La clé locale change à chaque nouvel appairage de la passerelle** — elle doit alors être relue et saisie à nouveau. Guide pas à pas pour débutants (en allemand, pour Android, iPhone et iPad) : [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](../Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](../Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. La passerelle est joignable depuis ioBroker (même réseau). Une réservation DHCP est recommandée ; sans adresse IP configurée, l'adaptateur trouve la passerelle grâce à ses diffusions UDP (ports 6666/6667).
4. **Les appareils Tuya n'acceptent généralement qu'une seule connexion locale.** Lors d'un test, l'application MiBoxer et l'adaptateur étaient connectés en même temps ; mais si la connexion échoue sans cesse, fermez l'application sur les téléphones du même réseau et ne pilotez pas la passerelle en même temps avec d'autres intégrations locales (ioBroker.tuya, Home Assistant, tinytuya).

## Configuration

Les paramètres de l'instance comportent deux onglets : **Passerelle** (connexion et commande des zones) et **Minuteries** (voir [Minuteries](#minuteries)).

| Paramètre | Description |
| --- | --- |
| ID d'appareil | ID d'appareil Tuya de la passerelle WL-433 |
| Clé locale | Clé locale Tuya de 16 caractères (stockée chiffrée) |
| Adresse IP de la passerelle | Laisser vide pour trouver la passerelle automatiquement sur le réseau local |
| Version du protocole Tuya | 3.3 pour le WL-433 (3.1, 3.4 et 3.5 sélectionnables) |
| Rechercher la passerelle sur le réseau local | Bouton : trouve la passerelle par son ID d'appareil et renseigne l'adresse IP et la version du protocole. Sans ID d'appareil, tous les appareils Tuya trouvés sont listés |
| Délai de reconnexion | Secondes avant une nouvelle tentative de connexion (30 par défaut) |
| Intervalle d'actualisation de l'état | Secondes entre deux demandes d'état complètes (60 par défaut, 0 = uniquement les mises à jour envoyées par la passerelle) |
| Commande des zones | *Sélecteur de zone* (par défaut) ou *un canal par zone*, voir [Zones](#zones) |

## Zones

La passerelle pilote jusqu'à 8 zones (comme la télécommande FUT086). Chaque commande peut aller à une zone ou à toutes les zones, mais la passerelle ne signale **qu'un seul état pour toutes les lampes : le dernier réglage, quelle que soit la zone à laquelle il a été envoyé**. L'application MiBoxer n'affiche pas non plus d'état séparé par zone. Le paramètre *Commande des zones* propose deux variantes :

| Variante | États | Adapté à |
| --- | --- | --- |
| **Sélecteur de zone (par défaut)** | `light.*` affiche l'état de la passerelle. `light.zone` (0 = toutes les zones, 1–8) choisit la zone à laquelle les commandes de `light.*` sont envoyées. | La plupart des utilisateurs : chaque état affiche ce que la passerelle signale |
| **Un canal par zone** | `light.*` affiche l'état de la passerelle et envoie à toutes les zones. En outre, `zones.zone1` … `zones.zone8` commandent chaque zone séparément. Un canal de zone affiche les dernières valeurs envoyées à cette zone et confirmées par la passerelle ; il reste vide tant que rien n'a été envoyé à la zone. | Scripts et visualisations qui adressent directement les zones |

Si le paramètre est modifié, les états de l'autre variante sont supprimés.

## Minuteries

L'onglet **Minuteries** des paramètres de l'instance contient jusqu'à **50 minuteries**. Elles s'exécutent localement dans l'adaptateur, même sans Internet, et vont plus loin que les minuteries de l'application MiBoxer : événements solaires avec décalage, décalage aléatoire, saison, zones, couleurs, scènes et extinction après une durée. Ajoutez une minuterie avec **+**, ouvrez-la pour la modifier, copiez-la ou supprimez-la avec les boutons de l'entrée. Les modifications prennent effet à l'enregistrement des paramètres (l'instance redémarre).

| Champ | Description |
| --- | --- |
| Actif | Désactive cette minuterie sans la supprimer |
| Nom | Affiché dans le journal et dans `timers.overview` |
| Déclencheur | *Heure* ou un événement solaire : aube, lever du soleil, heure dorée (soir), coucher du soleil, crépuscule, nuit |
| Heure | Uniquement pour le déclencheur *Heure* |
| Décalage | Minutes (de −720 à 720), négatif = plus tôt — par ex. coucher du soleil −15 |
| Décalage aléatoire | Jusqu'à ± minutes (0–120), tiré à nouveau à chaque exécution — pour une simulation de présence |
| Jours de la semaine | Jours où la minuterie s'exécute |
| Saison du / au | `DD.MM.`, par ex. du `01.05.` au `30.09.` ; une saison à cheval sur le nouvel an (du `01.11.` au `28.02.`) fonctionne aussi ; vide = toute l'année |
| Zone | Toutes les zones ou zone 1–8 |
| Action | Allumer, éteindre, lumière blanche (température de couleur 2700–6500 K), couleur, scène M1–M9, luminosité seulement |
| Luminosité | 1–100 %, vide = inchangée (pas pour *Éteindre*) |
| Éteindre après | Minutes (0–1440), 0 = ne pas éteindre (pas pour *Éteindre*) |

- Les **événements solaires** sont calculés à partir de la position définie dans les paramètres système d'ioBroker (latitude et longitude) avec [suncalc](https://github.com/mourner/suncalc). Sans position, ces minuteries sont ignorées avec un avertissement. Les jours sans cet événement (régions polaires), la minuterie ne s'exécute pas.
- Une minuterie envoie les mêmes commandes que les états : avec la commande des zones *sélecteur de zone* à sa zone (`light.zone` n'est pas modifié), avec *un canal par zone* via `zones.zone<n>` (toutes les zones : `light.*`). La passerelle les confirme comme toute commande.
- Si la passerelle n'est pas connectée à l'échéance d'une minuterie, cette exécution est sautée (avertissement dans le journal) — elle n'est pas rattrapée plus tard.
- Les minuteries aux paramètres incomplets sont ignorées ; le journal et `timers.overview` en indiquent la raison.
- Les heures sont les heures locales du système ioBroker ; l'heure d'été est prise en compte.
- Les **minuteries de l'application MiBoxer** sont enregistrées et exécutées dans le cloud Tuya (elles ne font qu'allumer ou éteindre toutes les zones via le point de données 20 et nécessitent Internet). L'adaptateur ne peut ni les lire ni les modifier, mais il voit leur effet dans l'état. Les deux types de minuteries peuvent être utilisés en même temps.

## États

| State | Description |
| --- | --- |
| `info.connection` | Connexion à la passerelle |
| `info.ip` | Adresse IP utilisée pour la passerelle |
| `light.on` | Marche / arrêt |
| `light.mode` | `white`, `colour` ou `scene` — l'écriture change de mode (mode couleur avec la dernière teinte, mode scène avec la dernière scène) |
| `light.brightness` | Luminosité 1–100 % du mode actuel. 0 éteint, une valeur supérieure à 0 allume |
| `light.colorTemperature` | Température de couleur 2700–6500 K par pas de 100 K (passe en mode blanc) |
| `light.color` | Couleur au format `#rrggbb` à pleine luminosité (passe en mode couleur). L'écriture règle la teinte et la saturation, la luminosité de la valeur RVB est ignorée — utilisez `light.brightness` |
| `light.hue` | Teinte 0–360° (passe en mode couleur) |
| `light.saturation` | Saturation 0–100 % (passe en mode couleur) |
| `light.scene` | Scène 1–9 (M1–M9 dans l'application), 0 = aucune scène. Écrire 1–9 lance la scène |
| `light.speedUp` / `light.speedDown` | Boutons S+ / S- de l'application : scène plus rapide / plus lente. La passerelle ne signale pas la vitesse |
| `light.countdown` | Secondes avant que la passerelle bascule les lampes (0 = désactivé, point de données standard 26) |
| `light.zone` | Uniquement avec le sélecteur de zone : zone des commandes `light.*`, 0 = toutes les zones, 1–8 |
| `zones.zone<n>.*` | Uniquement avec un canal par zone : `on`, `mode`, `brightness`, `colorTemperature`, `color`, `hue`, `saturation`, `scene`, `speedUp`, `speedDown` pour la zone n |
| `dp101.raw` | Dernière trame du point de données 101 en Base64 — l'écriture envoie la valeur telle quelle |
| `dp101.hex` | Dernière trame du point de données 101 en octets hexadécimaux — l'écriture envoie la trame, la somme de contrôle est ajoutée ou corrigée automatiquement |
| `dp101.checksumValid` | La somme de contrôle de la dernière trame est valide |
| `dp101.history` | Liste JSON des 50 dernières trames (`rx` = reçue, `tx` = envoyée) avec horodatage ; les réponses d'état identiques répétées ne sont pas ajoutées |
| `raw.dp<n>` | Tout autre point de données signalé par la passerelle est créé automatiquement (accessible en écriture) |
| `settings.dmxAddress` | Adresse de départ 1–512 de l'entrée DMX512 de la passerelle – à partir de celle-ci, la passerelle utilise 5 canaux : rouge, vert, bleu, blanc froid, blanc chaud (menu *DMX* de l'application). L'écriture l'envoie à la zone de `light.zone` (sélecteur de zone) ou à toutes les zones ; la passerelle la confirme |
| `timers.active` | `false` met toutes les minuteries en pause (par ex. pendant les vacances ou depuis un script), `true` les réactive |
| `timers.nextRun` | Prochaine exécution d'une minuterie avec le nom de la minuterie (`paused (…)` tant que `timers.active` vaut `false`) |
| `timers.lastRun` | Dernière exécution d'une minuterie avec son nom et son action |
| `timers.overview` | Liste JSON de toutes les minuteries : planification, action, prochaine exécution, raison si la minuterie est ignorée |

Les valeurs qui nécessitent un mode ou des lampes allumées sont envoyées comme le fait l'application MiBoxer : par exemple, une température de couleur en mode couleur passe d'abord en mode blanc, une luminosité alors que les lampes sont éteintes les allume d'abord. Les changements rapides (par ex. d'un curseur) sont regroupés, seule la dernière valeur est envoyée. Les commandes ne sont acceptées que lorsque la passerelle est connectée. Une commande est considérée comme exécutée lorsque l'état suivant de la passerelle affiche ses valeurs (environ 2,5 s plus tard) ; jusque-là, l'état n'est pas acquitté.

## Point de données 101 — protocole

Le WL-433 transporte les lampes, les zones et les scènes dans le point de données 101 spécifique au fabricant : trames de 12 octets, codées en Base64, le dernier octet est la somme sur 8 bits des octets 0–10. Le format a été décodé le 22/09/2026 à partir des trames d'état d'une vraie passerelle et des commandes que l'application MiBoxer écrit dans son journal Android :

| Trame | Bytes (hex) | Signification |
| --- | --- | --- |
| Commande (application / adaptateur → passerelle) | `41 00 00 0B cc vv vv vv vv zz 80 ss` | `cc` commande : `01` teinte 0–255 (valeur dans les octets 5–8, passe en mode couleur), `02` luminosité 1–100 %, `03` température de couleur 0–38 (2700 K + 100 K par pas), `04` saturation 0–100 %, `05` scène 1–9, `06` touche (`01` marche, `02` arrêt, `03` S-, `04` S+, `06` mode blanc) ; `zz` zone : `00` toutes, `01`–`08` |
| Demande d'état | `43 00 00 80 00 00 00 00 00 80 80 C3` | la passerelle répond par une trame d'état `44` |
| État (passerelle → application) | `42` / `44` `00 00 00 mm hh tt bb ss 0B dd xx` | `42` rapport de changement (environ 2,5 s après le dernier changement), `44` réponse à la demande ; `mm` mode : `00` éteint, `01` couleur, `02` blanc, `03`–`0B` scène 1–9 ; `hh` teinte, `tt` pas de température de couleur, `bb` luminosité, `ss` saturation (0 en mode blanc), `dd` octet de poids faible de l'adresse de départ DMX. La zone ne fait pas partie de l'état |
| Adresse de départ DMX | `49 00 00 0B 02 aa aa 00 00 zz 80 ss` | `aa aa` adresse 1–512 (octet de poids fort, octet de poids faible), `zz` zone ; réponse `49 00 00 0B 02 01 tt bb ss aa aa xx` |

La touche `06 05` éteint aussi les lampes (une seconde fois, elle les laisse éteintes, ce n'est pas une bascule) ; ce qu'elle fait de différent de `06 02` reste inconnu, l'adaptateur ne l'utilise pas. Les points de données standard 20–23 sont dérivés par la passerelle de ces commandes ; l'adaptateur n'utilise que le point de données 20 (marche/arrêt, signalé avant l'état) et suit l'état du point de données 101 pour tout le reste. L'écriture du point de données couleur Tuya 24 ne change pas la couleur des lampes — l'application MiBoxer ne l'utilise pas non plus.

Accès brut pour vos propres essais : `dp101.hex` accepte 11 octets (la somme de contrôle est ajoutée), par ex. `43 00 00 80 00 00 00 00 00 80 80` demande l'état.

## Limites

- La passerelle signale un seul état pour toutes les lampes (le dernier réglage) et non l'état de chaque zone — voir [Zones](#zones).
- La vitesse d'une scène (S+ / S-) n'est pas signalée par la passerelle.
- On ne peut pas voir si une lampe a réellement reçu une commande par radio : l'état provient de la passerelle.
- La passerelle continue de signaler son état au cloud Tuya. Bloquer complètement son accès à Internet peut la rendre peu fiable. Les minuteries de l'application MiBoxer ont besoin du cloud, celles de l'adaptateur non.

## Journalisation et dépannage

L'adaptateur journalise selon un schéma fixe, afin que le journal soit à tout moment exploitable pour un dépannage :

| Niveau | Ce qui est journalisé |
| --- | --- |
| error | Erreurs de configuration qui empêchent l'adaptateur de fonctionner (ID d'appareil manquant, clé locale différente de 16 caractères) |
| warn | Problèmes sur lesquels vous devez agir — signalés une fois, puis seulement au niveau debug jusqu'à leur résolution : la passerelle refuse les connexions, données indéchiffrables (mauvaise clé locale), commandes non confirmées par la passerelle, demandes d'état sans réponse, valeurs de points de données ou trames d'état inattendues, minuteries aux paramètres incomplets ou sans position pour les événements solaires, minuteries qui n'ont pas pu piloter les lampes, adresse de départ DMX non confirmée par la passerelle |
| info | Étapes clés : résumé de la configuration au démarrage, passerelle trouvée, connectée, connexion perdue, connexion de nouveau stable, objets de l'autre variante de zones supprimés, nombre de minuteries actives, minuteries en pause ou de nouveau actives |
| debug | Chaque étape avec ses entrées, décisions et durées : changement d'état → traduction en trames du point de données 101 (avec la raison des trames supplémentaires comme « allumer d'abord ») → file d'attente → envoi → confirmation par l'état (ou la valeur encore manquante), chaque point de données et état reçu et les états mis à jour, demandes d'état, recherche, chaque minuterie avec sa planification, sa prochaine exécution (événement solaire, décalage, décalage aléatoire) et son exécution. Les commandes (`#12`) et les tentatives de connexion (`Attempt #3`) sont numérotées, ce qui permet de suivre toutes les lignes d'une même commande |
| silly | En plus, la trace du protocole de la bibliothèque tuyapi (paquets, ping/pong) avec l'étiquette `[tuyapi]` |

Chaque message commence par une étiquette de composant : `[cfg]` configuration, `[conn]` connexion, `[rx]` passerelle → états, `[cmd]` états → commandes, `[queue]` file de commandes, `[poll]` actualisation et demande d'état, `[disc]` recherche, `[dp101]` trames brutes, `[timer]` minuteries, `[unload]` arrêt, `[tuyapi]` trace de la bibliothèque. La clé locale et les clés de session n'apparaissent jamais dans le journal — le résumé de la configuration n'indique que la longueur de la clé.

Pour changer le niveau : Admin → **Instances** → mode expert → niveau de journal de `miboxer-wl433.0` → `debug` (ou `silly` pour la trace du protocole ; redémarrez ensuite l'instance). Joignez un journal debug et le contenu de `dp101.history` lorsque vous signalez un problème.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.2.0 (2026-09-22)

- (ssbingo) Minuteries locales dans le nouvel onglet *Minuteries* des paramètres de l'instance (jusqu'à 50) : heure ou événement solaire avec décalage et décalage aléatoire, jours de la semaine, saison, zone, toutes les actions d'éclairage et extinction après une durée ; états `timers.active`, `timers.nextRun`, `timers.lastRun` et `timers.overview`
- (ssbingo) Adresse de départ de l'entrée DMX512 de la passerelle lisible et modifiable (`settings.dmxAddress`)
- (ssbingo) Documenté : commande DMX, touche `06 05`, minuteries cloud de l'application MiBoxer ; manuels avec un nouveau chapitre sur les minuteries

### 0.1.0 (2026-09-22)

- (ssbingo) Point de données 101 décodé : les lampes, zones et scènes sont désormais pilotées avec les commandes propres à la passerelle (la couleur ne pouvait pas être réglée auparavant), l'état est lu depuis le point de données 101 et demandé activement
- (ssbingo) Nouveaux états : teinte, saturation, scène M1–M9, boutons S+ / S- ; zones sélectionnables dans les paramètres comme sélecteur de zone (`light.zone`) ou un canal par zone
- (ssbingo) Les commandes sont confirmées par l'état de la passerelle, un avertissement est journalisé si la passerelle ne les confirme pas ; sortie debug détaillée pour chaque étape
- (ssbingo) Manuel utilisateur en allemand et en anglais pour les débutants

### 0.0.1 (2026-09-21)

- (ssbingo) Première version : pilotage local de la passerelle WL-433 via le protocole LAN Tuya (marche/arrêt, mode, luminosité, température de couleur, couleur, compte à rebours), accès brut au point de données 101 avec gestion de la somme de contrôle et recherche de la passerelle sur le réseau local, journalisation de débogage détaillée avec étiquettes de composants, numéros de commande et durées (les secrets ne sont jamais journalisés)

## Licence

Licence MIT — Copyright (c) 2026 ssbingo. Le texte complet de la licence figure dans le [English README](../../README.md#license) et dans le fichier [LICENSE](../../LICENSE).
