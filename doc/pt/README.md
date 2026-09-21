# ioBroker.miboxer-wl433

> [English README](../../README.md)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

Controlo local das luzes de piscina LoRa **MiBoxer PW01 / PW02** (433 MHz) através do gateway **MiBoxer WL-433** — sem nuvem, sem assistente de voz, diretamente na sua rede local.

Fabricante: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — [WL-433](https://miboxer.com/product/lora-433mhz-gateway), [PW01](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz)

## Aviso legal

Este é um **projeto comunitário não oficial**. **Não tem qualquer ligação** à Shenzhen Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) nem à Tuya, nem é apoiado por elas. «MiBoxer», «Mi-Light» e «Tuya» são marcas dos respetivos proprietários e são usadas apenas para descrever a compatibilidade dos dispositivos. Utilize este adaptador por sua conta e risco.

## Funcionamento

O WL-433 contém um módulo Wi-Fi Tuya. Na rede local, o gateway é **um único** dispositivo Tuya — todas as luzes associadas são controladas através dele, e o gateway envia os comandos às luzes via LoRa (433 MHz). O adaptador comunica diretamente com o gateway através do **protocolo LAN Tuya 3.3** (porta TCP 6668, cifrado com AES e a chave local), com base na biblioteca comprovada [tuyapi](https://github.com/codetheweb/tuyapi) (também usada pelo ioBroker.tuya). As versões de protocolo 3.1, 3.4 e 3.5 também são suportadas, caso uma atualização de firmware as altere.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

A pesquisa de base (análise do protocolo, fontes, plano de testes) está disponível em alemão: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Guia para associar as luzes ao gateway: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Hardware suportado

| Dispositivo | Função | Estado |
| --- | --- | --- |
| MiBoxer WL-433 | Obrigatório, o adaptador liga-se a ele | Protocolo Tuya 3.3 confirmado por um utilizador com hardware idêntico |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Luz associada ao gateway | Dispositivo alvo |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Luz associada ao gateway | Mesma família de produtos, deve funcionar |
| MiBoxer UW01, UW02, UW03, RD-9L | Luz associada ao gateway | Não testado |

## Requisitos

1. O gateway está configurado na app MiBoxer e as luzes estão associadas a ele.
2. **ID do dispositivo e chave local** do gateway. O fabricante não suporta a plataforma de programadores Tuya para o WL-433, mas a app MiBoxer escreve ambos os valores no seu registo de depuração: no Android, leia o registo com um visualizador logcat como o *LogFox* enquanto a app inicia e controla o gateway. **A chave local muda sempre que o gateway é emparelhado novamente** — nesse caso tem de ser lida e introduzida outra vez.
3. O gateway está acessível a partir do ioBroker (mesma rede). Recomenda-se uma reserva DHCP; sem endereço IP configurado, o adaptador encontra o gateway pelas suas difusões UDP (portas 6666/6667).
4. **Os dispositivos Tuya aceitam apenas uma ligação local.** Feche a app MiBoxer nos telemóveis da mesma rede e não controle o gateway ao mesmo tempo com outras integrações locais (ioBroker.tuya, Home Assistant, tinytuya).

## Configuração

| Definição | Descrição |
| --- | --- |
| ID do dispositivo | ID Tuya do gateway WL-433 |
| Chave local | Chave local Tuya de 16 caracteres (guardada cifrada) |
| Endereço IP do gateway | Deixe vazio para encontrar o gateway automaticamente na rede local |
| Versão do protocolo Tuya | 3.3 para o WL-433 (3.1, 3.4 e 3.5 selecionáveis) |
| Procurar gateway na rede local | Botão: encontra o gateway pelo ID do dispositivo e preenche o endereço IP e a versão do protocolo. Sem ID lista todos os dispositivos Tuya encontrados |
| Atraso de religação | Segundos até nova tentativa de ligação (predefinição 30) |
| Intervalo de atualização do estado | Segundos entre pedidos completos de estado (predefinição 60, 0 = apenas atualizações enviadas pelo gateway) |

## Estados

| State | Tuya DP | Descrição |
| --- | --- | --- |
| `info.connection` | – | Ligação ao gateway |
| `info.ip` | – | Endereço IP usado para o gateway |
| `light.on` | 20 | Ligar/desligar todas as luzes |
| `light.mode` | 21 | `white`, `colour`, `scene`, `music` |
| `light.brightness` | 22 / 24 | Brilho 0–100 %. No modo de cor altera-se o brilho da cor (DP 24), caso contrário o brilho do branco (DP 22). 0 desliga, um valor acima de 0 liga |
| `light.colorTemperature` | 23 | Temperatura de cor 2700–6500 K (muda para o modo branco) |
| `light.color` | 24 | Cor como `#rrggbb` (muda para o modo de cor) |
| `light.countdown` | 26 | Segundos até o gateway comutar as luzes (0 = desligado) |
| `dp101.raw` | 101 | Última trama DP 101 em Base64 — escrever envia o valor sem alterações |
| `dp101.hex` | 101 | Última trama DP 101 em bytes hex — escrever envia a trama, a soma de verificação é acrescentada ou corrigida automaticamente |
| `dp101.checksumValid` | 101 | A soma de verificação da última trama é válida |
| `dp101.history` | 101 | Lista JSON das últimas 50 tramas (`rx` = recebida, `tx` = enviada) com carimbo temporal |
| `raw.dp<n>` | n | Qualquer outro ponto de dados comunicado pelo gateway é criado automaticamente (gravável) |

Alterações rápidas (por exemplo, de um cursor) são agrupadas num único comando. Os comandos só são aceites enquanto o gateway estiver ligado.

## Ponto de dados 101 — zonas e cenas

O WL-433 transmite os comandos de zonas e cenas no ponto de dados 101 específico do fabricante: tramas binárias de 12 bytes, codificadas em Base64, em que o último byte é a soma de 8 bits dos bytes 0–10. O significado dos restantes bytes **ainda não foi descodificado**. Até lá, o adaptador oferece acesso direto:

- as tramas recebidas aparecem em `dp101.raw` / `dp101.hex` e ficam registadas em `dp101.history`,
- é possível enviar tramas através de `dp101.hex` — bastam 11 bytes, a soma de verificação é acrescentada automaticamente, p. ex. `43 00 00 80 00 00 00 00 00 80 80`

**Procura-se ajuda:** execute uma ação de cada vez na app MiBoxer (por zona: ligar, desligar, cor, cena 1–9) e anote as tramas de `dp101.history`. Com registos suficientes será possível descodificar as tramas e acrescentar estados próprios para zonas e cenas. O procedimento está descrito no capítulo 6 da análise do protocolo.

## Limitações

- Os pontos de dados padrão 20–26 atuam sobre todas as luzes do gateway (possivelmente apenas sobre a zona selecionada na app). Zonas e cenas separadas virão quando o ponto de dados 101 estiver descodificado.
- O gateway continua a comunicar o seu estado à nuvem Tuya. Bloquear totalmente o acesso à internet pode torná-lo pouco fiável.
- Esta primeira versão foi testada com uma simulação do gateway (protocolo Tuya 3.3). Comentários com hardware real são muito bem-vindos.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) Primeira versão: controlo local do gateway WL-433 através do protocolo LAN da Tuya (ligar/desligar, modo, brilho, temperatura de cor, cor, contagem decrescente), acesso direto ao ponto de dados 101 com tratamento da soma de verificação e pesquisa do gateway na rede local

## Licença

Licença MIT — Copyright (c) 2026 ssbingo. O texto completo da licença encontra-se no [English README](../../README.md#license) e no ficheiro [LICENSE](../../LICENSE).
