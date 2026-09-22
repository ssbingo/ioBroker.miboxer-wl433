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

El WL-433 contiene un módulo Wi-Fi de Tuya. En la red local, la pasarela es **un único** dispositivo Tuya: todas las lámparas vinculadas se controlan a través de él y la pasarela reenvía los comandos por LoRa (433 MHz) a las lámparas. El adaptador habla directamente el **protocolo LAN de Tuya 3.3** (puerto TCP 6668, cifrado AES con la clave local) con la pasarela, basándose en la probada biblioteca [tuyapi](https://github.com/codetheweb/tuyapi) (también usada por ioBroker.tuya). También se admiten las versiones de protocolo 3.1, 3.4 y 3.5, por si una actualización de firmware la cambia.

Las lámparas, zonas y escenas se controlan con los comandos propios de la pasarela en el **punto de datos 101** específico del fabricante, los mismos comandos que envía la aplicación MiBoxer. La pasarela informa su estado de la misma forma; además, el adaptador lo solicita al conectarse y en cada actualización de estado.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

**Manual** con cada paso explicado para principiantes (instalación, ajustes, zonas, temporizadores, ejemplos, solución de problemas): [English](../Manual_miboxer-wl433.md) ([PDF](../Manual_miboxer-wl433.pdf)) · [Deutsch](../Handbuch_miboxer-wl433.md) ([PDF](../Handbuch_miboxer-wl433.pdf)).

Investigación de fondo (análisis del protocolo, fuentes, plan de pruebas, punto de datos 101 descifrado), en alemán: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Guía para vincular las lámparas a la pasarela: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Hardware compatible

| Dispositivo | Función | Estado |
| --- | --- | --- |
| MiBoxer WL-433 | Obligatorio, el adaptador se conecta a él | Probado con una pasarela real (protocolo Tuya 3.3, punto de datos 101) |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lámpara vinculada a la pasarela | Dispositivo objetivo |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lámpara vinculada a la pasarela | Misma familia de productos, debería funcionar |
| MiBoxer UW01, UW02, UW03, RD-9L | Lámpara vinculada a la pasarela | Sin probar |

## Requisitos

1. La pasarela está configurada en la aplicación MiBoxer y las lámparas están vinculadas a ella.
2. **ID de dispositivo y clave local** de la pasarela. El fabricante no admite la plataforma de desarrolladores de Tuya para el WL-433, pero la aplicación MiBoxer escribe ambos valores en su registro de depuración: en Android, lea el registro con un visor de logcat como *LogFox* mientras la aplicación se inicia y controla la pasarela. **La clave local cambia cada vez que la pasarela se vuelve a emparejar**; entonces hay que leerla e introducirla de nuevo. Guía paso a paso para principiantes (en alemán, para Android, iPhone y iPad): [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](../Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](../Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. La pasarela es accesible desde ioBroker (misma red). Se recomienda una reserva DHCP; sin dirección IP configurada, el adaptador encuentra la pasarela mediante sus difusiones UDP (puertos 6666/6667).
4. **Los dispositivos Tuya suelen aceptar solo una conexión local.** En una prueba, la aplicación MiBoxer y el adaptador estuvieron conectados a la vez; pero si la conexión falla una y otra vez, cierre la aplicación en los teléfonos de la misma red y no controle la pasarela al mismo tiempo con otras integraciones locales (ioBroker.tuya, Home Assistant, tinytuya).

## Configuración

Los ajustes de la instancia tienen dos pestañas: **Pasarela** (conexión y control de zonas) y **Temporizadores** (ver [Temporizadores](#temporizadores)).

| Ajuste | Descripción |
| --- | --- |
| ID de dispositivo | ID de dispositivo Tuya de la pasarela WL-433 |
| Clave local | Clave local de Tuya de 16 caracteres (se guarda cifrada) |
| Dirección IP de la pasarela | Déjela vacía para encontrar la pasarela automáticamente en la red local |
| Versión del protocolo Tuya | 3.3 para el WL-433 (se pueden elegir 3.1, 3.4 y 3.5) |
| Buscar la pasarela en la red local | Botón: encuentra la pasarela por su ID de dispositivo y rellena la dirección IP y la versión del protocolo. Sin ID de dispositivo se listan todos los dispositivos Tuya encontrados |
| Tiempo de espera para reconectar | Segundos hasta reintentar una conexión perdida o fallida (30 por defecto) |
| Intervalo de actualización del estado | Segundos entre solicitudes de estado completas (60 por defecto, 0 = solo las actualizaciones que envía la pasarela) |
| Control de zonas | *Selector de zona* (por defecto) o *un canal por zona*, ver [Zonas](#zonas) |

## Zonas

La pasarela controla hasta 8 zonas (como el mando FUT086). Cada comando puede ir a una zona o a todas, pero la pasarela informa **solo un estado para todas las lámparas: el último ajuste, sin importar a qué zona se envió**. La aplicación MiBoxer tampoco muestra un estado propio por zona. El ajuste *Control de zonas* ofrece dos variantes:

| Variante | Estados | Adecuado para |
| --- | --- | --- |
| **Selector de zona (por defecto)** | `light.*` muestra el estado de la pasarela. `light.zone` (0 = todas las zonas, 1–8) selecciona la zona a la que se envían los comandos de `light.*`. | La mayoría de usuarios: cada estado muestra lo que informa la pasarela |
| **Un canal por zona** | `light.*` muestra el estado de la pasarela y envía a todas las zonas. Además, `zones.zone1` … `zones.zone8` controlan cada zona por separado. Un canal de zona muestra los últimos valores enviados a esa zona y confirmados por la pasarela; permanece vacío hasta que se envía algo a la zona. | Scripts y visualizaciones que se dirigen directamente a las zonas |

Si se cambia el ajuste, se eliminan los estados de la otra variante.

## Temporizadores

La pestaña **Temporizadores** de los ajustes de la instancia contiene hasta **50 temporizadores**. Se ejecutan localmente en el adaptador, también sin Internet, y pueden hacer más que los temporizadores de la aplicación MiBoxer: eventos solares con desplazamiento, desviación aleatoria, temporada, zonas, colores, escenas y apagado tras una duración. Añada un temporizador con **+**, ábralo para modificarlo, cópielo o elimínelo con los botones de la entrada. Los cambios surten efecto al guardar los ajustes (la instancia se reinicia).

| Campo | Descripción |
| --- | --- |
| Activo | Desactiva este temporizador sin eliminarlo |
| Nombre | Se muestra en el registro y en `timers.overview` |
| Disparador | *Hora del día* o un evento solar: amanecer, salida del sol, hora dorada (tarde), puesta del sol, anochecer, noche |
| Hora del día | Solo para el disparador *Hora del día* |
| Desplazamiento | Minutos (de −720 a 720), negativo = antes; p. ej. puesta del sol −15 |
| Desviación aleatoria | Hasta ± minutos (0–120), se sortea de nuevo en cada ejecución; para una simulación de presencia |
| Días de la semana | Días en los que se ejecuta el temporizador |
| Temporada desde / hasta | `DD.MM.`, p. ej. desde `01.05.` hasta `30.09.`; también funciona una temporada que cruza el año nuevo (desde `01.11.` hasta `28.02.`); vacío = todo el año |
| Zona | Todas las zonas o zona 1–8 |
| Acción | Encender, apagar, luz blanca (temperatura de color 2700–6500 K), color, escena M1–M9, solo brillo |
| Brillo | 1–100 %, vacío = sin cambios (no para *Apagar*) |
| Apagar después de | Minutos (0–1440), 0 = no apagar (no para *Apagar*) |

- Los **eventos solares** se calculan a partir de la posición indicada en los ajustes del sistema de ioBroker (latitud y longitud) con [suncalc](https://github.com/mourner/suncalc). Sin posición, estos temporizadores se ignoran con una advertencia. Los días sin el evento (regiones polares), el temporizador no se ejecuta.
- Un temporizador envía los mismos comandos que los estados: con el control de zonas *selector de zona* a su zona (`light.zone` no se modifica), con *un canal por zona* a través de `zones.zone<n>` (todas las zonas: `light.*`). La pasarela los confirma como cualquier comando.
- Si la pasarela no está conectada cuando vence un temporizador, esa ejecución se omite (advertencia en el registro) y no se repite más tarde.
- Los temporizadores con ajustes incompletos se ignoran; el registro y `timers.overview` indican el motivo.
- Las horas son horas locales del sistema ioBroker; se tiene en cuenta el horario de verano.
- Los **temporizadores de la aplicación MiBoxer** se guardan y ejecutan en la nube de Tuya (solo encienden o apagan todas las zonas mediante el punto de datos 20 y necesitan Internet). El adaptador no puede leerlos ni modificarlos, pero ve su efecto en el estado. Ambos tipos de temporizadores pueden usarse a la vez.

## Estados

| State | Descripción |
| --- | --- |
| `info.connection` | Conexión con la pasarela |
| `info.ip` | Dirección IP utilizada para la pasarela |
| `light.on` | Encendido / apagado |
| `light.mode` | `white`, `colour` o `scene`: escribirlo cambia el modo (modo color con el último tono, modo escena con la última escena) |
| `light.brightness` | Brillo 1–100 % del modo actual. 0 apaga, un valor mayor que 0 enciende |
| `light.colorTemperature` | Temperatura de color 2700–6500 K en pasos de 100 K (cambia al modo blanco) |
| `light.color` | Color como `#rrggbb` con brillo máximo (cambia al modo color). Escribirlo ajusta el tono y la saturación, el brillo del valor RGB se ignora; use `light.brightness` |
| `light.hue` | Tono 0–360° (cambia al modo color) |
| `light.saturation` | Saturación 0–100 % (cambia al modo color) |
| `light.scene` | Escena 1–9 (M1–M9 en la aplicación), 0 = sin escena. Escribir 1–9 inicia la escena |
| `light.speedUp` / `light.speedDown` | Botones S+ / S- de la aplicación: escena más rápida / más lenta. La pasarela no informa la velocidad |
| `light.countdown` | Segundos hasta que la pasarela conmuta las lámparas (0 = desactivado, punto de datos estándar 26) |
| `light.zone` | Solo con el selector de zona: zona de los comandos `light.*`, 0 = todas las zonas, 1–8 |
| `zones.zone<n>.*` | Solo con un canal por zona: `on`, `mode`, `brightness`, `colorTemperature`, `color`, `hue`, `saturation`, `scene`, `speedUp`, `speedDown` para la zona n |
| `dp101.raw` | Última trama del punto de datos 101 en Base64: escribirlo envía el valor sin cambios |
| `dp101.hex` | Última trama del punto de datos 101 en bytes hexadecimales: escribirlo envía la trama, la suma de verificación se añade o corrige automáticamente |
| `dp101.checksumValid` | La suma de verificación de la última trama es válida |
| `dp101.history` | Lista JSON de las últimas 50 tramas (`rx` = recibida, `tx` = enviada) con marca de tiempo; las respuestas de estado idénticas repetidas no se añaden |
| `raw.dp<n>` | Cualquier otro punto de datos que informe la pasarela se crea automáticamente (con escritura) |
| `settings.dmxAddress` | Dirección de inicio 1–512 de la entrada DMX512 de la pasarela: a partir de ella, la pasarela usa 5 canales: rojo, verde, azul, blanco frío, blanco cálido (menú *DMX* de la aplicación). Escribirla la envía a la zona de `light.zone` (selector de zona) o a todas las zonas; la pasarela la confirma |
| `timers.active` | `false` pausa todos los temporizadores (p. ej. durante las vacaciones o desde un script), `true` los vuelve a activar |
| `timers.nextRun` | Próxima ejecución de un temporizador con su nombre (`paused (…)` mientras `timers.active` sea `false`) |
| `timers.lastRun` | Última ejecución de un temporizador con nombre y acción |
| `timers.overview` | Lista JSON de todos los temporizadores: programación, acción, próxima ejecución, motivo si el temporizador se ignora |

Los valores que necesitan un modo o las lámparas encendidas se envían como lo hace la aplicación MiBoxer: por ejemplo, una temperatura de color en modo color cambia primero al modo blanco, y un brillo con las lámparas apagadas las enciende primero. Los cambios rápidos (p. ej. de un deslizador) se agrupan y solo se envía el último valor. Los comandos solo se aceptan mientras la pasarela está conectada. Un comando se considera ejecutado cuando el siguiente estado de la pasarela muestra sus valores (unos 2,5 s después); hasta entonces el estado no está confirmado.

## Punto de datos 101 — protocolo

El WL-433 transporta lámparas, zonas y escenas en el punto de datos 101 específico del fabricante: tramas de 12 bytes codificadas en Base64, el último byte es la suma de 8 bits de los bytes 0–10. El formato se descifró el 22/09/2026 a partir de las tramas de estado de una pasarela real y de los comandos que la aplicación MiBoxer escribe en su registro de Android:

| Trama | Bytes (hex) | Significado |
| --- | --- | --- |
| Comando (aplicación / adaptador → pasarela) | `41 00 00 0B cc vv vv vv vv zz 80 ss` | `cc` comando: `01` tono 0–255 (valor en los bytes 5–8, cambia al modo color), `02` brillo 1–100 %, `03` temperatura de color 0–38 (2700 K + 100 K por paso), `04` saturación 0–100 %, `05` escena 1–9, `06` tecla (`01` encender, `02` apagar, `03` S-, `04` S+, `06` modo blanco); `zz` zona: `00` todas, `01`–`08` |
| Solicitud de estado | `43 00 00 80 00 00 00 00 00 80 80 C3` | la pasarela responde con una trama de estado `44` |
| Estado (pasarela → aplicación) | `42` / `44` `00 00 00 mm hh tt bb ss 0B dd xx` | `42` informe de cambio (unos 2,5 s después del último cambio), `44` respuesta a la solicitud; `mm` modo: `00` apagado, `01` color, `02` blanco, `03`–`0B` escena 1–9; `hh` tono, `tt` paso de temperatura de color, `bb` brillo, `ss` saturación (0 en modo blanco), `dd` byte bajo de la dirección de inicio DMX. La zona no forma parte del estado |
| Dirección de inicio DMX | `49 00 00 0B 02 aa aa 00 00 zz 80 ss` | `aa aa` dirección 1–512 (byte alto, byte bajo), `zz` zona; respuesta `49 00 00 0B 02 01 tt bb ss aa aa xx` |

La tecla `06 05` también apaga las lámparas (pulsada una segunda vez las mantiene apagadas, no alterna); qué hace distinto de `06 02` todavía se desconoce, el adaptador no la usa. La pasarela deriva los puntos de datos estándar 20–23 de estos comandos; el adaptador solo usa el punto de datos 20 (encendido/apagado, llega antes que el estado) y para todo lo demás sigue el estado del punto de datos 101. Escribir el punto de datos de color de Tuya 24 no cambia el color de las lámparas; la aplicación MiBoxer tampoco lo usa.

Acceso en bruto para sus propios experimentos: `dp101.hex` acepta 11 bytes (se añade la suma de verificación), p. ej. `43 00 00 80 00 00 00 00 00 80 80` solicita el estado.

## Limitaciones

- La pasarela informa un solo estado para todas las lámparas (el último ajuste) y no el estado de cada zona; ver [Zonas](#zonas).
- La pasarela no informa la velocidad de una escena (S+ / S-).
- No se puede ver si una lámpara ha recibido realmente un comando por radio: el estado procede de la pasarela.
- La pasarela sigue informando su estado a la nube de Tuya. Bloquear por completo su acceso a Internet puede hacerla poco fiable. Los temporizadores de la aplicación MiBoxer necesitan la nube, los del adaptador no.

## Registro y solución de problemas

El adaptador registra según un esquema fijo, para que el registro sea útil en todo momento para localizar errores:

| Nivel | Qué se registra |
| --- | --- |
| error | Errores de configuración que impiden funcionar al adaptador (falta el ID de dispositivo, la clave local no tiene 16 caracteres) |
| warn | Problemas sobre los que debe actuar; se informan una vez y después solo en nivel debug hasta que se resuelven: la pasarela rechaza conexiones, datos que no se pueden descifrar (clave local incorrecta), comandos no confirmados por la pasarela, solicitudes de estado sin respuesta, valores de puntos de datos o tramas de estado inesperados, temporizadores con ajustes incompletos o sin posición para los eventos solares, temporizadores que no pudieron conmutar las lámparas, una dirección de inicio DMX no confirmada por la pasarela |
| info | Hitos: resumen de la configuración al inicio, pasarela encontrada, conectada, conexión perdida, conexión de nuevo estable, objetos de la otra variante de zonas eliminados, número de temporizadores activos, temporizadores en pausa o de nuevo activos |
| debug | Cada paso con sus entradas, decisiones y duraciones: cambio de estado → traducción a tramas del punto de datos 101 (con el motivo de tramas adicionales como «encender primero») → cola de comandos → envío → confirmación por el estado (o qué valor falta todavía), cada punto de datos y estado recibido y los estados que actualiza, solicitudes de estado, búsqueda, cada temporizador con su programación, su próxima ejecución (evento solar, desplazamiento, desviación aleatoria) y su ejecución. Los comandos (`#12`) y los intentos de conexión (`Attempt #3`) están numerados, de modo que se pueden seguir todas las líneas de un mismo comando |
| silly | Además, el rastro del protocolo de la biblioteca tuyapi (paquetes, ping/pong) con la etiqueta `[tuyapi]` |

Cada mensaje empieza con una etiqueta de componente: `[cfg]` configuración, `[conn]` conexión, `[rx]` pasarela → estados, `[cmd]` estados → comandos, `[queue]` cola de comandos, `[poll]` actualización y solicitud de estado, `[disc]` búsqueda, `[dp101]` tramas en bruto, `[timer]` temporizadores, `[unload]` cierre, `[tuyapi]` rastro de la biblioteca. La clave local y las claves de sesión nunca aparecen en el registro; el resumen de la configuración solo muestra la longitud de la clave.

Para cambiar el nivel: Admin → **Instancias** → modo experto → nivel de registro de `miboxer-wl433.0` → `debug` (o `silly` para el rastro del protocolo; después reinicie la instancia). Adjunte un registro debug y el contenido de `dp101.history` cuando informe de un problema.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.2.0 (2026-09-22)

- (ssbingo) Temporizadores locales en la nueva pestaña *Temporizadores* de los ajustes de la instancia (hasta 50): hora del día o evento solar con desplazamiento y desviación aleatoria, días de la semana, temporada, zona, cualquier acción de luz y apagado tras una duración; estados `timers.active`, `timers.nextRun`, `timers.lastRun` y `timers.overview`
- (ssbingo) Dirección de inicio de la entrada DMX512 de la pasarela legible y escribible (`settings.dmxAddress`)
- (ssbingo) Documentado: comando DMX, tecla `06 05`, temporizadores en la nube de la aplicación MiBoxer; manuales con un nuevo capítulo sobre temporizadores

### 0.1.0 (2026-09-22)

- (ssbingo) Punto de datos 101 descifrado: las lámparas, zonas y escenas se controlan ahora con los comandos propios de la pasarela (antes no se podía ajustar el color), el estado se lee del punto de datos 101 y se solicita activamente
- (ssbingo) Nuevos estados: tono, saturación, escena M1–M9, botones S+ / S-; zonas seleccionables en los ajustes como selector de zona (`light.zone`) o un canal por zona
- (ssbingo) Los comandos se confirman con el estado de la pasarela y se registra una advertencia si la pasarela no los confirma; salida debug detallada para cada paso
- (ssbingo) Manual de usuario en alemán e inglés para principiantes

### 0.0.1 (2026-09-21)

- (ssbingo) Primera versión: control local de la pasarela WL-433 mediante el protocolo LAN de Tuya (encendido/apagado, modo, brillo, temperatura de color, color, cuenta atrás), acceso directo al punto de datos 101 con gestión de la suma de verificación y búsqueda de la pasarela en la red local, registro de depuración detallado con etiquetas de componentes, números de comando y duraciones (los secretos nunca se registran)

## Licencia

Licencia MIT — Copyright (c) 2026 ssbingo. El texto completo de la licencia está en el [English README](../../README.md#license) y en el archivo [LICENSE](../../LICENSE).
