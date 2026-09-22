"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var object_names_exports = {};
__export(object_names_exports, {
  LANGUAGES: () => LANGUAGES,
  OBJECT_NAMES: () => OBJECT_NAMES,
  objectName: () => objectName
});
module.exports = __toCommonJS(object_names_exports);
const LANGUAGES = ["en", "de", "ru", "pt", "nl", "fr", "it", "es", "pl", "uk", "zh-cn"];
const OBJECT_NAMES = {
  on: {
    en: "On / off",
    de: "Ein / Aus",
    ru: "\u0412\u043A\u043B. / \u0432\u044B\u043A\u043B.",
    pt: "Ligar / desligar",
    nl: "Aan / uit",
    fr: "Marche / arr\xEAt",
    it: "Acceso / spento",
    es: "Encendido / apagado",
    pl: "W\u0142. / wy\u0142.",
    uk: "\u0423\u0432\u0456\u043C\u043A. / \u0432\u0438\u043C\u043A.",
    "zh-cn": "\u5F00 / \u5173"
  },
  mode: {
    en: "Mode",
    de: "Modus",
    ru: "\u0420\u0435\u0436\u0438\u043C",
    pt: "Modo",
    nl: "Modus",
    fr: "Mode",
    it: "Modalit\xE0",
    es: "Modo",
    pl: "Tryb",
    uk: "\u0420\u0435\u0436\u0438\u043C",
    "zh-cn": "\u6A21\u5F0F"
  },
  scene: {
    en: "Scene M1\u2013M9 (0 = no scene)",
    de: "Szene M1\u2013M9 (0 = keine Szene)",
    ru: "\u0421\u0446\u0435\u043D\u0430 M1\u2013M9 (0 = \u0431\u0435\u0437 \u0441\u0446\u0435\u043D\u044B)",
    pt: "Cena M1\u2013M9 (0 = sem cena)",
    nl: "Sc\xE8ne M1\u2013M9 (0 = geen sc\xE8ne)",
    fr: "Sc\xE8ne M1\u2013M9 (0 = aucune sc\xE8ne)",
    it: "Scena M1\u2013M9 (0 = nessuna scena)",
    es: "Escena M1\u2013M9 (0 = sin escena)",
    pl: "Scena M1\u2013M9 (0 = brak sceny)",
    uk: "\u0421\u0446\u0435\u043D\u0430 M1\u2013M9 (0 = \u0431\u0435\u0437 \u0441\u0446\u0435\u043D\u0438)",
    "zh-cn": "\u573A\u666F M1\u2013M9\uFF080 = \u65E0\u573A\u666F\uFF09"
  },
  brightness: {
    en: "Brightness",
    de: "Helligkeit",
    ru: "\u042F\u0440\u043A\u043E\u0441\u0442\u044C",
    pt: "Brilho",
    nl: "Helderheid",
    fr: "Luminosit\xE9",
    it: "Luminosit\xE0",
    es: "Brillo",
    pl: "Jasno\u015B\u0107",
    uk: "\u042F\u0441\u043A\u0440\u0430\u0432\u0456\u0441\u0442\u044C",
    "zh-cn": "\u4EAE\u5EA6"
  },
  colorTemperature: {
    en: "Colour temperature (white mode)",
    de: "Farbtemperatur (Wei\xDFmodus)",
    ru: "\u0426\u0432\u0435\u0442\u043E\u0432\u0430\u044F \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 (\u0431\u0435\u043B\u044B\u0439 \u0440\u0435\u0436\u0438\u043C)",
    pt: "Temperatura de cor (modo branco)",
    nl: "Kleurtemperatuur (witmodus)",
    fr: "Temp\xE9rature de couleur (mode blanc)",
    it: "Temperatura di colore (modalit\xE0 bianco)",
    es: "Temperatura de color (modo blanco)",
    pl: "Temperatura barwowa (tryb bia\u0142ego)",
    uk: "\u041A\u043E\u043B\u0456\u0440\u043D\u0430 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 (\u0431\u0456\u043B\u0438\u0439 \u0440\u0435\u0436\u0438\u043C)",
    "zh-cn": "\u8272\u6E29\uFF08\u767D\u5149\u6A21\u5F0F\uFF09"
  },
  color: {
    en: "Colour #rrggbb (colour mode)",
    de: "Farbe #rrggbb (Farbmodus)",
    ru: "\u0426\u0432\u0435\u0442 #rrggbb (\u0446\u0432\u0435\u0442\u043D\u043E\u0439 \u0440\u0435\u0436\u0438\u043C)",
    pt: "Cor #rrggbb (modo de cor)",
    nl: "Kleur #rrggbb (kleurmodus)",
    fr: "Couleur #rrggbb (mode couleur)",
    it: "Colore #rrggbb (modalit\xE0 colore)",
    es: "Color #rrggbb (modo color)",
    pl: "Kolor #rrggbb (tryb koloru)",
    uk: "\u041A\u043E\u043B\u0456\u0440 #rrggbb (\u043A\u043E\u043B\u044C\u043E\u0440\u043E\u0432\u0438\u0439 \u0440\u0435\u0436\u0438\u043C)",
    "zh-cn": "\u989C\u8272 #rrggbb\uFF08\u5F69\u8272\u6A21\u5F0F\uFF09"
  },
  hue: {
    en: "Hue (colour mode)",
    de: "Farbton (Farbmodus)",
    ru: "\u041E\u0442\u0442\u0435\u043D\u043E\u043A (\u0446\u0432\u0435\u0442\u043D\u043E\u0439 \u0440\u0435\u0436\u0438\u043C)",
    pt: "Matiz (modo de cor)",
    nl: "Tint (kleurmodus)",
    fr: "Teinte (mode couleur)",
    it: "Tonalit\xE0 (modalit\xE0 colore)",
    es: "Tono (modo color)",
    pl: "Odcie\u0144 (tryb koloru)",
    uk: "\u0412\u0456\u0434\u0442\u0456\u043D\u043E\u043A (\u043A\u043E\u043B\u044C\u043E\u0440\u043E\u0432\u0438\u0439 \u0440\u0435\u0436\u0438\u043C)",
    "zh-cn": "\u8272\u8C03\uFF08\u5F69\u8272\u6A21\u5F0F\uFF09"
  },
  saturation: {
    en: "Saturation (colour mode)",
    de: "S\xE4ttigung (Farbmodus)",
    ru: "\u041D\u0430\u0441\u044B\u0449\u0435\u043D\u043D\u043E\u0441\u0442\u044C (\u0446\u0432\u0435\u0442\u043D\u043E\u0439 \u0440\u0435\u0436\u0438\u043C)",
    pt: "Satura\xE7\xE3o (modo de cor)",
    nl: "Verzadiging (kleurmodus)",
    fr: "Saturation (mode couleur)",
    it: "Saturazione (modalit\xE0 colore)",
    es: "Saturaci\xF3n (modo color)",
    pl: "Nasycenie (tryb koloru)",
    uk: "\u041D\u0430\u0441\u0438\u0447\u0435\u043D\u0456\u0441\u0442\u044C (\u043A\u043E\u043B\u044C\u043E\u0440\u043E\u0432\u0438\u0439 \u0440\u0435\u0436\u0438\u043C)",
    "zh-cn": "\u9971\u548C\u5EA6\uFF08\u5F69\u8272\u6A21\u5F0F\uFF09"
  },
  speedUp: {
    en: "Scene faster (S+)",
    de: "Szene schneller (S+)",
    ru: "\u0421\u0446\u0435\u043D\u0430 \u0431\u044B\u0441\u0442\u0440\u0435\u0435 (S+)",
    pt: "Cena mais r\xE1pida (S+)",
    nl: "Sc\xE8ne sneller (S+)",
    fr: "Sc\xE8ne plus rapide (S+)",
    it: "Scena pi\xF9 veloce (S+)",
    es: "Escena m\xE1s r\xE1pida (S+)",
    pl: "Scena szybciej (S+)",
    uk: "\u0421\u0446\u0435\u043D\u0430 \u0448\u0432\u0438\u0434\u0448\u0435 (S+)",
    "zh-cn": "\u573A\u666F\u52A0\u901F\uFF08S+\uFF09"
  },
  speedDown: {
    en: "Scene slower (S-)",
    de: "Szene langsamer (S-)",
    ru: "\u0421\u0446\u0435\u043D\u0430 \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u0435\u0435 (S-)",
    pt: "Cena mais lenta (S-)",
    nl: "Sc\xE8ne langzamer (S-)",
    fr: "Sc\xE8ne plus lente (S-)",
    it: "Scena pi\xF9 lenta (S-)",
    es: "Escena m\xE1s lenta (S-)",
    pl: "Scena wolniej (S-)",
    uk: "\u0421\u0446\u0435\u043D\u0430 \u043F\u043E\u0432\u0456\u043B\u044C\u043D\u0456\u0448\u0435 (S-)",
    "zh-cn": "\u573A\u666F\u51CF\u901F\uFF08S-\uFF09"
  },
  ip: {
    en: "IP address of the gateway",
    de: "IP-Adresse des Gateways",
    ru: "IP-\u0430\u0434\u0440\u0435\u0441 \u0448\u043B\u044E\u0437\u0430",
    pt: "Endere\xE7o IP do gateway",
    nl: "IP-adres van de gateway",
    fr: "Adresse IP de la passerelle",
    it: "Indirizzo IP del gateway",
    es: "Direcci\xF3n IP de la pasarela",
    pl: "Adres IP bramki",
    uk: "IP-\u0430\u0434\u0440\u0435\u0441\u0430 \u0448\u043B\u044E\u0437\u0443",
    "zh-cn": "\u7F51\u5173\u7684 IP \u5730\u5740"
  },
  countdown: {
    en: "Countdown until toggle (DP 26)",
    de: "Countdown bis zum Umschalten (DP 26)",
    ru: "\u041E\u0431\u0440\u0430\u0442\u043D\u044B\u0439 \u043E\u0442\u0441\u0447\u0451\u0442 \u0434\u043E \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F (DP 26)",
    pt: "Contagem decrescente at\xE9 alternar (DP 26)",
    nl: "Aftellen tot omschakelen (DP 26)",
    fr: "Compte \xE0 rebours avant basculement (DP 26)",
    it: "Conto alla rovescia fino alla commutazione (DP 26)",
    es: "Cuenta atr\xE1s hasta conmutar (DP 26)",
    pl: "Odliczanie do prze\u0142\u0105czenia (DP 26)",
    uk: "\u0417\u0432\u043E\u0440\u043E\u0442\u043D\u0438\u0439 \u0432\u0456\u0434\u043B\u0456\u043A \u0434\u043E \u043F\u0435\u0440\u0435\u043C\u0438\u043A\u0430\u043D\u043D\u044F (DP 26)",
    "zh-cn": "\u5207\u6362\u5012\u8BA1\u65F6\uFF08DP 26\uFF09"
  },
  dp101: {
    en: "Datapoint 101 (raw frames of zones, scenes and status)",
    de: "Datenpunkt 101 (Roh-Frames f\xFCr Zonen, Szenen und Status)",
    ru: "\u0422\u043E\u0447\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445 101 (\u0441\u044B\u0440\u044B\u0435 \u043A\u0430\u0434\u0440\u044B \u0437\u043E\u043D, \u0441\u0446\u0435\u043D \u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F)",
    pt: "Ponto de dados 101 (frames brutos de zonas, cenas e estado)",
    nl: "Datapunt 101 (ruwe frames van zones, sc\xE8nes en status)",
    fr: "Point de donn\xE9es 101 (trames brutes des zones, sc\xE8nes et \xE9tat)",
    it: "Punto dati 101 (frame grezzi di zone, scene e stato)",
    es: "Punto de datos 101 (tramas sin procesar de zonas, escenas y estado)",
    pl: "Punkt danych 101 (surowe ramki stref, scen i stanu)",
    uk: "\u0422\u043E\u0447\u043A\u0430 \u0434\u0430\u043D\u0438\u0445 101 (\u0441\u0438\u0440\u0456 \u043A\u0430\u0434\u0440\u0438 \u0437\u043E\u043D, \u0441\u0446\u0435\u043D \u0456 \u0441\u0442\u0430\u043D\u0443)",
    "zh-cn": "\u6570\u636E\u70B9 101\uFF08\u533A\u57DF\u3001\u573A\u666F\u548C\u72B6\u6001\u7684\u539F\u59CB\u5E27\uFF09"
  },
  dp101Raw: {
    en: "Last frame as Base64 (writable)",
    de: "Letzter Frame als Base64 (schreibbar)",
    ru: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043A\u0430\u0434\u0440 \u0432 Base64 (\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u0437\u0430\u043F\u0438\u0441\u0438)",
    pt: "\xDAltimo frame em Base64 (grav\xE1vel)",
    nl: "Laatste frame als Base64 (schrijfbaar)",
    fr: "Derni\xE8re trame en Base64 (modifiable)",
    it: "Ultimo frame in Base64 (scrivibile)",
    es: "\xDAltima trama en Base64 (escribible)",
    pl: "Ostatnia ramka jako Base64 (zapisywalna)",
    uk: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456\u0439 \u043A\u0430\u0434\u0440 \u0443 Base64 (\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0438\u0439 \u0434\u043B\u044F \u0437\u0430\u043F\u0438\u0441\u0443)",
    "zh-cn": "\u6700\u540E\u4E00\u5E27\uFF0CBase64\uFF08\u53EF\u5199\uFF09"
  },
  dp101Hex: {
    en: "Last frame as hex (writable, checksum is added automatically)",
    de: "Letzter Frame als Hex (schreibbar, Pr\xFCfsumme wird automatisch erg\xE4nzt)",
    ru: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043A\u0430\u0434\u0440 \u0432 hex (\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0434\u043B\u044F \u0437\u0430\u043F\u0438\u0441\u0438, \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438)",
    pt: "\xDAltimo frame em hex (grav\xE1vel, a soma de verifica\xE7\xE3o \xE9 adicionada automaticamente)",
    nl: "Laatste frame als hex (schrijfbaar, controlesom wordt automatisch toegevoegd)",
    fr: "Derni\xE8re trame en hexad\xE9cimal (modifiable, la somme de contr\xF4le est ajout\xE9e automatiquement)",
    it: "Ultimo frame in esadecimale (scrivibile, il checksum viene aggiunto automaticamente)",
    es: "\xDAltima trama en hexadecimal (escribible, la suma de comprobaci\xF3n se a\xF1ade autom\xE1ticamente)",
    pl: "Ostatnia ramka jako hex (zapisywalna, suma kontrolna jest dodawana automatycznie)",
    uk: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456\u0439 \u043A\u0430\u0434\u0440 \u0443 hex (\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0438\u0439 \u0434\u043B\u044F \u0437\u0430\u043F\u0438\u0441\u0443, \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430 \u0434\u043E\u0434\u0430\u0454\u0442\u044C\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E)",
    "zh-cn": "\u6700\u540E\u4E00\u5E27\uFF0C\u5341\u516D\u8FDB\u5236\uFF08\u53EF\u5199\uFF0C\u81EA\u52A8\u6DFB\u52A0\u6821\u9A8C\u548C\uFF09"
  },
  dp101ChecksumValid: {
    en: "Checksum of the last frame is valid",
    de: "Pr\xFCfsumme des letzten Frames ist g\xFCltig",
    ru: "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u043A\u0430\u0434\u0440\u0430 \u0432\u0435\u0440\u043D\u0430",
    pt: "A soma de verifica\xE7\xE3o do \xFAltimo frame \xE9 v\xE1lida",
    nl: "Controlesom van het laatste frame is geldig",
    fr: "La somme de contr\xF4le de la derni\xE8re trame est valide",
    it: "Il checksum dell'ultimo frame \xE8 valido",
    es: "La suma de comprobaci\xF3n de la \xFAltima trama es v\xE1lida",
    pl: "Suma kontrolna ostatniej ramki jest poprawna",
    uk: "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430 \u0441\u0443\u043C\u0430 \u043E\u0441\u0442\u0430\u043D\u043D\u044C\u043E\u0433\u043E \u043A\u0430\u0434\u0440\u0443 \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0430",
    "zh-cn": "\u6700\u540E\u4E00\u5E27\u7684\u6821\u9A8C\u548C\u6709\u6548"
  },
  dp101History: {
    en: "Last {0} frames (received and sent)",
    de: "Letzte {0} Frames (empfangen und gesendet)",
    ru: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 {0} \u043A\u0430\u0434\u0440\u043E\u0432 (\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044B\u0435 \u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0435)",
    pt: "\xDAltimos {0} frames (recebidos e enviados)",
    nl: "Laatste {0} frames (ontvangen en verzonden)",
    fr: "{0} derni\xE8res trames (re\xE7ues et envoy\xE9es)",
    it: "Ultimi {0} frame (ricevuti e inviati)",
    es: "\xDAltimas {0} tramas (recibidas y enviadas)",
    pl: "Ostatnie {0} ramek (odebrane i wys\u0142ane)",
    uk: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456 {0} \u043A\u0430\u0434\u0440\u0456\u0432 (\u043E\u0442\u0440\u0438\u043C\u0430\u043D\u0456 \u0442\u0430 \u043D\u0430\u0434\u0456\u0441\u043B\u0430\u043D\u0456)",
    "zh-cn": "\u6700\u8FD1 {0} \u5E27\uFF08\u63A5\u6536\u548C\u53D1\u9001\uFF09"
  },
  raw: {
    en: "Other datapoints",
    de: "Weitere Datenpunkte",
    ru: "\u0414\u0440\u0443\u0433\u0438\u0435 \u0442\u043E\u0447\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445",
    pt: "Outros pontos de dados",
    nl: "Overige datapunten",
    fr: "Autres points de donn\xE9es",
    it: "Altri punti dati",
    es: "Otros puntos de datos",
    pl: "Inne punkty danych",
    uk: "\u0406\u043D\u0448\u0456 \u0442\u043E\u0447\u043A\u0438 \u0434\u0430\u043D\u0438\u0445",
    "zh-cn": "\u5176\u4ED6\u6570\u636E\u70B9"
  },
  rawDatapoint: {
    en: "Datapoint {0}",
    de: "Datenpunkt {0}",
    ru: "\u0422\u043E\u0447\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445 {0}",
    pt: "Ponto de dados {0}",
    nl: "Datapunt {0}",
    fr: "Point de donn\xE9es {0}",
    it: "Punto dati {0}",
    es: "Punto de datos {0}",
    pl: "Punkt danych {0}",
    uk: "\u0422\u043E\u0447\u043A\u0430 \u0434\u0430\u043D\u0438\u0445 {0}",
    "zh-cn": "\u6570\u636E\u70B9 {0}"
  },
  settings: {
    en: "Gateway settings",
    de: "Gateway-Einstellungen",
    ru: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0448\u043B\u044E\u0437\u0430",
    pt: "Defini\xE7\xF5es do gateway",
    nl: "Gateway-instellingen",
    fr: "Param\xE8tres de la passerelle",
    it: "Impostazioni del gateway",
    es: "Ajustes de la pasarela",
    pl: "Ustawienia bramki",
    uk: "\u041D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F \u0448\u043B\u044E\u0437\u0443",
    "zh-cn": "\u7F51\u5173\u8BBE\u7F6E"
  },
  dmxAddress: {
    en: "DMX start address (5 channels: R, G, B, cold white, warm white)",
    de: "DMX-Startadresse (5 Kan\xE4le: R, G, B, Kaltwei\xDF, Warmwei\xDF)",
    ru: "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 \u0430\u0434\u0440\u0435\u0441 DMX (5 \u043A\u0430\u043D\u0430\u043B\u043E\u0432: R, G, B, \u0445\u043E\u043B\u043E\u0434\u043D\u044B\u0439 \u0431\u0435\u043B\u044B\u0439, \u0442\u0451\u043F\u043B\u044B\u0439 \u0431\u0435\u043B\u044B\u0439)",
    pt: "Endere\xE7o inicial DMX (5 canais: R, G, B, branco frio, branco quente)",
    nl: "DMX-startadres (5 kanalen: R, G, B, koud wit, warm wit)",
    fr: "Adresse de d\xE9part DMX (5 canaux : R, G, B, blanc froid, blanc chaud)",
    it: "Indirizzo iniziale DMX (5 canali: R, G, B, bianco freddo, bianco caldo)",
    es: "Direcci\xF3n de inicio DMX (5 canales: R, G, B, blanco fr\xEDo, blanco c\xE1lido)",
    pl: "Adres startowy DMX (5 kana\u0142\xF3w: R, G, B, zimna biel, ciep\u0142a biel)",
    uk: "\u041F\u043E\u0447\u0430\u0442\u043A\u043E\u0432\u0430 \u0430\u0434\u0440\u0435\u0441\u0430 DMX (5 \u043A\u0430\u043D\u0430\u043B\u0456\u0432: R, G, B, \u0445\u043E\u043B\u043E\u0434\u043D\u0438\u0439 \u0431\u0456\u043B\u0438\u0439, \u0442\u0435\u043F\u043B\u0438\u0439 \u0431\u0456\u043B\u0438\u0439)",
    "zh-cn": "DMX \u8D77\u59CB\u5730\u5740\uFF085 \u4E2A\u901A\u9053\uFF1AR\u3001G\u3001B\u3001\u51B7\u767D\u3001\u6696\u767D\uFF09"
  },
  timers: {
    en: "Timers (tab Timers in the instance settings)",
    de: "Timer (Reiter Timer in den Instanzeinstellungen)",
    ru: "\u0422\u0430\u0439\u043C\u0435\u0440\u044B (\u0432\u043A\u043B\u0430\u0434\u043A\u0430 \xAB\u0422\u0430\u0439\u043C\u0435\u0440\u044B\xBB \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440\u0430)",
    pt: "Temporizadores (separador Temporizadores nas defini\xE7\xF5es da inst\xE2ncia)",
    nl: "Timers (tabblad Timers in de instantie-instellingen)",
    fr: "Minuteries (onglet Minuteries des param\xE8tres de l'instance)",
    it: "Timer (scheda Timer nelle impostazioni dell'istanza)",
    es: "Temporizadores (pesta\xF1a Temporizadores en los ajustes de la instancia)",
    pl: "Timery (karta Timery w ustawieniach instancji)",
    uk: "\u0422\u0430\u0439\u043C\u0435\u0440\u0438 (\u0432\u043A\u043B\u0430\u0434\u043A\u0430 \xAB\u0422\u0430\u0439\u043C\u0435\u0440\u0438\xBB \u0432 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F\u0445 \u0435\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440\u0430)",
    "zh-cn": "\u5B9A\u65F6\u5668\uFF08\u5B9E\u4F8B\u8BBE\u7F6E\u4E2D\u7684\u201C\u5B9A\u65F6\u5668\u201D\u9009\u9879\u5361\uFF09"
  },
  timersActive: {
    en: "Timers active (false = all timers paused)",
    de: "Timer aktiv (false = alle Timer pausiert)",
    ru: "\u0422\u0430\u0439\u043C\u0435\u0440\u044B \u0430\u043A\u0442\u0438\u0432\u043D\u044B (false = \u0432\u0441\u0435 \u0442\u0430\u0439\u043C\u0435\u0440\u044B \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B)",
    pt: "Temporizadores ativos (false = todos os temporizadores em pausa)",
    nl: "Timers actief (false = alle timers gepauzeerd)",
    fr: "Minuteries actives (false = toutes les minuteries en pause)",
    it: "Timer attivi (false = tutti i timer in pausa)",
    es: "Temporizadores activos (false = todos los temporizadores en pausa)",
    pl: "Timery aktywne (false = wszystkie timery wstrzymane)",
    uk: "\u0422\u0430\u0439\u043C\u0435\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u0456 (false = \u0443\u0441\u0456 \u0442\u0430\u0439\u043C\u0435\u0440\u0438 \u043F\u0440\u0438\u0437\u0443\u043F\u0438\u043D\u0435\u043D\u043E)",
    "zh-cn": "\u5B9A\u65F6\u5668\u5DF2\u542F\u7528\uFF08false = \u6682\u505C\u6240\u6709\u5B9A\u65F6\u5668\uFF09"
  },
  timersNextRun: {
    en: "Next timer run",
    de: "N\xE4chste Timer-Ausf\xFChrung",
    ru: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0435 \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u043D\u0438\u0435 \u0442\u0430\u0439\u043C\u0435\u0440\u0430",
    pt: "Pr\xF3xima execu\xE7\xE3o do temporizador",
    nl: "Volgende uitvoering van een timer",
    fr: "Prochaine ex\xE9cution d'une minuterie",
    it: "Prossima esecuzione del timer",
    es: "Pr\xF3xima ejecuci\xF3n del temporizador",
    pl: "Nast\u0119pne uruchomienie timera",
    uk: "\u041D\u0430\u0441\u0442\u0443\u043F\u043D\u0435 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F \u0442\u0430\u0439\u043C\u0435\u0440\u0430",
    "zh-cn": "\u4E0B\u6B21\u5B9A\u65F6\u5668\u8FD0\u884C"
  },
  timersLastRun: {
    en: "Last timer run",
    de: "Letzte Timer-Ausf\xFChrung",
    ru: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u043D\u0438\u0435 \u0442\u0430\u0439\u043C\u0435\u0440\u0430",
    pt: "\xDAltima execu\xE7\xE3o do temporizador",
    nl: "Laatste uitvoering van een timer",
    fr: "Derni\xE8re ex\xE9cution d'une minuterie",
    it: "Ultima esecuzione del timer",
    es: "\xDAltima ejecuci\xF3n del temporizador",
    pl: "Ostatnie uruchomienie timera",
    uk: "\u041E\u0441\u0442\u0430\u043D\u043D\u0454 \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F \u0442\u0430\u0439\u043C\u0435\u0440\u0430",
    "zh-cn": "\u4E0A\u6B21\u5B9A\u65F6\u5668\u8FD0\u884C"
  },
  timersOverview: {
    en: "All timers (max. {0}) with their next run",
    de: "Alle Timer (max. {0}) mit n\xE4chster Ausf\xFChrung",
    ru: "\u0412\u0441\u0435 \u0442\u0430\u0439\u043C\u0435\u0440\u044B (\u043C\u0430\u043A\u0441. {0}) \u0441\u043E \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u043C \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u043D\u0438\u0435\u043C",
    pt: "Todos os temporizadores (m\xE1x. {0}) com a pr\xF3xima execu\xE7\xE3o",
    nl: "Alle timers (max. {0}) met hun volgende uitvoering",
    fr: "Toutes les minuteries (max. {0}) avec leur prochaine ex\xE9cution",
    it: "Tutti i timer (max. {0}) con la prossima esecuzione",
    es: "Todos los temporizadores (m\xE1x. {0}) con su pr\xF3xima ejecuci\xF3n",
    pl: "Wszystkie timery (maks. {0}) z nast\u0119pnym uruchomieniem",
    uk: "\u0423\u0441\u0456 \u0442\u0430\u0439\u043C\u0435\u0440\u0438 (\u043C\u0430\u043A\u0441. {0}) \u0437 \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u043C \u0441\u043F\u0440\u0430\u0446\u044E\u0432\u0430\u043D\u043D\u044F\u043C",
    "zh-cn": "\u6240\u6709\u5B9A\u65F6\u5668\uFF08\u6700\u591A {0} \u4E2A\uFF09\u53CA\u5176\u4E0B\u6B21\u8FD0\u884C"
  },
  lightSelector: {
    en: "Pool lights (status of the gateway, commands to the zone in light.zone)",
    de: "Poolleuchten (Status des Gateways, Befehle an die Zone in light.zone)",
    ru: "\u041E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u0435 \u0431\u0430\u0441\u0441\u0435\u0439\u043D\u0430 (\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0448\u043B\u044E\u0437\u0430, \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0432 \u0437\u043E\u043D\u0443 \u0438\u0437 light.zone)",
    pt: "Luzes da piscina (estado do gateway, comandos para a zona em light.zone)",
    nl: "Zwembadverlichting (status van de gateway, opdrachten naar de zone in light.zone)",
    fr: "\xC9clairage de piscine (\xE9tat de la passerelle, commandes vers la zone de light.zone)",
    it: "Luci della piscina (stato del gateway, comandi alla zona in light.zone)",
    es: "Luces de la piscina (estado de la pasarela, \xF3rdenes a la zona de light.zone)",
    pl: "O\u015Bwietlenie basenu (stan bramki, polecenia do strefy z light.zone)",
    uk: "\u041E\u0441\u0432\u0456\u0442\u043B\u0435\u043D\u043D\u044F \u0431\u0430\u0441\u0435\u0439\u043D\u0443 (\u0441\u0442\u0430\u043D \u0448\u043B\u044E\u0437\u0443, \u043A\u043E\u043C\u0430\u043D\u0434\u0438 \u0434\u043E \u0437\u043E\u043D\u0438 \u0437 light.zone)",
    "zh-cn": "\u6CF3\u6C60\u706F\uFF08\u7F51\u5173\u72B6\u6001\uFF0C\u547D\u4EE4\u53D1\u9001\u5230 light.zone \u4E2D\u7684\u533A\u57DF\uFF09"
  },
  lightAllZones: {
    en: "Pool lights (status of the gateway, commands to all zones)",
    de: "Poolleuchten (Status des Gateways, Befehle an alle Zonen)",
    ru: "\u041E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u0435 \u0431\u0430\u0441\u0441\u0435\u0439\u043D\u0430 (\u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0448\u043B\u044E\u0437\u0430, \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0432\u043E \u0432\u0441\u0435 \u0437\u043E\u043D\u044B)",
    pt: "Luzes da piscina (estado do gateway, comandos para todas as zonas)",
    nl: "Zwembadverlichting (status van de gateway, opdrachten naar alle zones)",
    fr: "\xC9clairage de piscine (\xE9tat de la passerelle, commandes vers toutes les zones)",
    it: "Luci della piscina (stato del gateway, comandi a tutte le zone)",
    es: "Luces de la piscina (estado de la pasarela, \xF3rdenes a todas las zonas)",
    pl: "O\u015Bwietlenie basenu (stan bramki, polecenia do wszystkich stref)",
    uk: "\u041E\u0441\u0432\u0456\u0442\u043B\u0435\u043D\u043D\u044F \u0431\u0430\u0441\u0435\u0439\u043D\u0443 (\u0441\u0442\u0430\u043D \u0448\u043B\u044E\u0437\u0443, \u043A\u043E\u043C\u0430\u043D\u0434\u0438 \u0434\u043E \u0432\u0441\u0456\u0445 \u0437\u043E\u043D)",
    "zh-cn": "\u6CF3\u6C60\u706F\uFF08\u7F51\u5173\u72B6\u6001\uFF0C\u547D\u4EE4\u53D1\u9001\u5230\u6240\u6709\u533A\u57DF\uFF09"
  },
  zoneSelector: {
    en: "Zone for the commands of light.* (0 = all zones)",
    de: "Zone f\xFCr die Befehle von light.* (0 = alle Zonen)",
    ru: "\u0417\u043E\u043D\u0430 \u0434\u043B\u044F \u043A\u043E\u043C\u0430\u043D\u0434 light.* (0 = \u0432\u0441\u0435 \u0437\u043E\u043D\u044B)",
    pt: "Zona para os comandos de light.* (0 = todas as zonas)",
    nl: "Zone voor de opdrachten van light.* (0 = alle zones)",
    fr: "Zone des commandes de light.* (0 = toutes les zones)",
    it: "Zona per i comandi di light.* (0 = tutte le zone)",
    es: "Zona para las \xF3rdenes de light.* (0 = todas las zonas)",
    pl: "Strefa dla polece\u0144 light.* (0 = wszystkie strefy)",
    uk: "\u0417\u043E\u043D\u0430 \u0434\u043B\u044F \u043A\u043E\u043C\u0430\u043D\u0434 light.* (0 = \u0443\u0441\u0456 \u0437\u043E\u043D\u0438)",
    "zh-cn": "light.* \u547D\u4EE4\u7684\u533A\u57DF\uFF080 = \u6240\u6709\u533A\u57DF\uFF09"
  },
  zones: {
    en: "Zones (last values sent)",
    de: "Zonen (zuletzt gesendete Werte)",
    ru: "\u0417\u043E\u043D\u044B (\u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F)",
    pt: "Zonas (\xFAltimos valores enviados)",
    nl: "Zones (laatst verzonden waarden)",
    fr: "Zones (derni\xE8res valeurs envoy\xE9es)",
    it: "Zone (ultimi valori inviati)",
    es: "Zonas (\xFAltimos valores enviados)",
    pl: "Strefy (ostatnio wys\u0142ane warto\u015Bci)",
    uk: "\u0417\u043E\u043D\u0438 (\u043E\u0441\u0442\u0430\u043D\u043D\u0456 \u043D\u0430\u0434\u0456\u0441\u043B\u0430\u043D\u0456 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F)",
    "zh-cn": "\u533A\u57DF\uFF08\u6700\u540E\u53D1\u9001\u7684\u503C\uFF09"
  },
  zone: {
    en: "Zone {0}",
    de: "Zone {0}",
    ru: "\u0417\u043E\u043D\u0430 {0}",
    pt: "Zona {0}",
    nl: "Zone {0}",
    fr: "Zone {0}",
    it: "Zona {0}",
    es: "Zona {0}",
    pl: "Strefa {0}",
    uk: "\u0417\u043E\u043D\u0430 {0}",
    "zh-cn": "\u533A\u57DF {0}"
  }
};
function objectName(key, value) {
  const names = OBJECT_NAMES[key];
  const result = {};
  for (const language of LANGUAGES) {
    result[language] = value === void 0 ? names[language] : names[language].replace("{0}", String(value));
  }
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LANGUAGES,
  OBJECT_NAMES,
  objectName
});
//# sourceMappingURL=object-names.js.map
