# ioBroker.miboxer-wl433

> [English README](../../README.md)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

Control local de los focos de piscina LoRa **MiBoxer PW01 / PW02** (433 MHz) a través de la pasarela **MiBoxer WL-433** — sin nube, sin asistente de voz, directamente en su red local.

Fabricante: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — [WL-433](https://miboxer.com/product/lora-433mhz-gateway), [PW01](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz)

## Aviso legal

Este es un **proyecto comunitario no oficial**. **No está afiliado, respaldado ni apoyado** por Shenzhen Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) ni por Tuya. «MiBoxer», «Mi-Light» y «Tuya» son marcas de sus respectivos propietarios y solo se usan para describir la compatibilidad de los dispositivos. Úselo bajo su propia responsabilidad.

## Funcionamiento

El WL-433 contiene un módulo Wi-Fi de Tuya. En la red local, la pasarela es **un único** dispositivo Tuya — todos los focos vinculados se controlan a través de él y la pasarela envía los comandos a los focos mediante LoRa (433 MHz). El adaptador se comunica directamente con la pasarela mediante el **protocolo LAN de Tuya 3.3** (puerto TCP 6668, cifrado AES con la clave local), basándose en la probada biblioteca [tuyapi](https://github.com/codetheweb/tuyapi) (también usada por ioBroker.tuya). También se admiten las versiones de protocolo 3.1, 3.4 y 3.5, por si una actualización de firmware las cambia.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

La investigación de base (análisis del protocolo, fuentes, plan de pruebas) está disponible en alemán: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Guía para vincular los focos a la pasarela: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Hardware compatible

| Dispositivo | Función | Estado |
| --- | --- | --- |
| MiBoxer WL-433 | Obligatorio, el adaptador se conecta a él | Protocolo Tuya 3.3 confirmado por un usuario con hardware idéntico |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Foco vinculado a la pasarela | Dispositivo objetivo |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Foco vinculado a la pasarela | Misma familia de productos, debería funcionar |
| MiBoxer UW01, UW02, UW03, RD-9L | Foco vinculado a la pasarela | Sin probar |

## Requisitos

1. La pasarela está configurada en la app MiBoxer y los focos están vinculados a ella.
2. **ID del dispositivo y clave local** de la pasarela. El fabricante no admite la plataforma de desarrolladores de Tuya para el WL-433, pero la app MiBoxer escribe ambos valores en su registro de depuración: en Android, lea el registro con un visor de logcat como *LogFox* mientras la app se inicia y controla la pasarela. **La clave local cambia cada vez que la pasarela se vuelve a emparejar** — entonces hay que leerla e introducirla de nuevo.
3. La pasarela es accesible desde ioBroker (misma red). Se recomienda una reserva DHCP; sin dirección IP configurada, el adaptador encuentra la pasarela mediante sus difusiones UDP (puertos 6666/6667).
4. **Los dispositivos Tuya solo aceptan una conexión local.** Cierre la app MiBoxer en los teléfonos de la misma red y no controle la pasarela al mismo tiempo con otras integraciones locales (ioBroker.tuya, Home Assistant, tinytuya).

## Configuración

| Ajuste | Descripción |
| --- | --- |
| ID del dispositivo | ID Tuya de la pasarela WL-433 |
| Clave local | Clave local de Tuya de 16 caracteres (guardada cifrada) |
| Dirección IP de la pasarela | Dejar vacío para encontrar la pasarela automáticamente en la red local |
| Versión del protocolo Tuya | 3.3 para el WL-433 (se pueden elegir 3.1, 3.4 y 3.5) |
| Buscar la pasarela en la red local | Botón: encuentra la pasarela por su ID y rellena la dirección IP y la versión del protocolo. Sin ID lista todos los dispositivos Tuya encontrados |
| Retardo de reconexión | Segundos hasta un nuevo intento de conexión (30 por defecto) |
| Intervalo de actualización del estado | Segundos entre consultas completas del estado (60 por defecto, 0 = solo actualizaciones enviadas por la pasarela) |

## Estados

| State | Tuya DP | Descripción |
| --- | --- | --- |
| `info.connection` | – | Conexión con la pasarela |
| `info.ip` | – | Dirección IP usada para la pasarela |
| `light.on` | 20 | Encender/apagar todos los focos |
| `light.mode` | 21 | `white`, `colour`, `scene`, `music` |
| `light.brightness` | 22 / 24 | Brillo 0–100 %. En modo color se cambia el brillo del color (DP 24), si no, el brillo del blanco (DP 22). 0 apaga, un valor mayor que 0 enciende |
| `light.colorTemperature` | 23 | Temperatura de color 2700–6500 K (cambia al modo blanco) |
| `light.color` | 24 | Color como `#rrggbb` (cambia al modo color) |
| `light.countdown` | 26 | Segundos hasta que la pasarela conmuta los focos (0 = desactivado) |
| `dp101.raw` | 101 | Última trama DP 101 en Base64 — al escribir se envía el valor sin cambios |
| `dp101.hex` | 101 | Última trama DP 101 en bytes hexadecimales — al escribir se envía la trama, la suma de verificación se añade o corrige automáticamente |
| `dp101.checksumValid` | 101 | La suma de verificación de la última trama es válida |
| `dp101.history` | 101 | Lista JSON de las últimas 50 tramas (`rx` = recibida, `tx` = enviada) con marca de tiempo |
| `raw.dp<n>` | n | Cualquier otro punto de datos que comunique la pasarela se crea automáticamente (escribible) |

Los cambios rápidos (p. ej., de un control deslizante) se agrupan en un solo comando. Los comandos solo se aceptan mientras la pasarela está conectada.

## Punto de datos 101 — zonas y escenas

El WL-433 transmite los comandos de zonas y escenas en el punto de datos 101 específico del fabricante: tramas binarias de 12 bytes, codificadas en Base64, cuyo último byte es la suma de 8 bits de los bytes 0–10. El significado de los demás bytes **aún no está decodificado**. Hasta entonces, el adaptador ofrece acceso directo:

- las tramas recibidas aparecen en `dp101.raw` / `dp101.hex` y se registran en `dp101.history`,
- se pueden enviar tramas mediante `dp101.hex` — bastan 11 bytes, la suma de verificación se añade automáticamente, p. ej. `43 00 00 80 00 00 00 00 00 80 80`

**Se busca ayuda:** realice en la app MiBoxer una sola acción cada vez (por zona: encender, apagar, color, escena 1–9) y anote las tramas de `dp101.history`. Con suficientes registros se podrán decodificar las tramas y añadir estados propios para zonas y escenas. El procedimiento se describe en el capítulo 6 del análisis del protocolo.

## Limitaciones

- Los puntos de datos estándar 20–26 actúan sobre todos los focos de la pasarela (posiblemente solo sobre la zona seleccionada en la app). Las zonas y escenas separadas llegarán cuando se decodifique el punto de datos 101.
- La pasarela sigue comunicando su estado a la nube de Tuya. Bloquear por completo su acceso a internet puede hacerla poco fiable.
- Esta primera versión se ha probado con una simulación de la pasarela (protocolo Tuya 3.3). Los comentarios con hardware real son muy bienvenidos.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) Primera versión: control local de la pasarela WL-433 mediante el protocolo LAN de Tuya (encendido/apagado, modo, brillo, temperatura de color, color, cuenta atrás), acceso directo al punto de datos 101 con gestión de la suma de verificación y búsqueda de la pasarela en la red local

## Licencia

Licencia MIT — Copyright (c) 2026 ssbingo. El texto completo de la licencia está en el [English README](../../README.md#license) y en el archivo [LICENSE](../../LICENSE).
