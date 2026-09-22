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

O WL-433 contém um módulo Wi-Fi Tuya. Na rede local, o gateway é **um único** dispositivo Tuya: todas as lâmpadas associadas são controladas através dele e o gateway reencaminha os comandos por LoRa (433 MHz) para as lâmpadas. O adaptador fala diretamente o **protocolo LAN Tuya 3.3** (porta TCP 6668, cifra AES com a chave local) com o gateway, com base na biblioteca comprovada [tuyapi](https://github.com/codetheweb/tuyapi) (também usada pelo ioBroker.tuya). As versões de protocolo 3.1, 3.4 e 3.5 também são suportadas, caso uma atualização de firmware a altere.

Lâmpadas, zonas e cenas são controladas com os comandos próprios do gateway no **ponto de dados 101** específico do fabricante — os mesmos comandos que a aplicação MiBoxer envia. O gateway comunica o seu estado da mesma forma; o adaptador também o pede ao ligar-se e em cada atualização do estado.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

**Manual do utilizador** com cada passo explicado para principiantes (instalação, definições, zonas, temporizadores, exemplos, resolução de problemas): [English](../Manual_miboxer-wl433.md) ([PDF](../Manual_miboxer-wl433.pdf)) · [Deutsch](../Handbuch_miboxer-wl433.md) ([PDF](../Handbuch_miboxer-wl433.pdf)).

Investigação de base (análise do protocolo, fontes, plano de testes, ponto de dados 101 descodificado), em alemão: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Guia para associar as lâmpadas ao gateway: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Hardware suportado

| Dispositivo | Função | Estado |
| --- | --- | --- |
| MiBoxer WL-433 | Obrigatório, o adaptador liga-se a ele | Testado com um gateway real (protocolo Tuya 3.3, ponto de dados 101) |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lâmpada associada ao gateway | Dispositivo alvo |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lâmpada associada ao gateway | Mesma família de produtos, deverá funcionar |
| MiBoxer UW01, UW02, UW03, RD-9L | Lâmpada associada ao gateway | Não testado |

## Requisitos

1. O gateway está configurado na aplicação MiBoxer e as lâmpadas estão associadas a ele.
2. **ID do dispositivo e chave local** do gateway. O fabricante não suporta a plataforma de programadores Tuya para o WL-433, mas a aplicação MiBoxer escreve ambos os valores no seu registo de depuração: no Android, leia o registo com um visualizador logcat como o *LogFox* enquanto a aplicação arranca e controla o gateway. **A chave local muda sempre que o gateway é emparelhado de novo** — nesse caso tem de ser lida e introduzida novamente. Guia passo a passo para principiantes (em alemão, para Android, iPhone e iPad): [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](../Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](../Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. O gateway está acessível a partir do ioBroker (mesma rede). Recomenda-se uma reserva DHCP; sem endereço IP configurado, o adaptador encontra o gateway através das suas difusões UDP (portas 6666/6667).
4. **Os dispositivos Tuya normalmente aceitam apenas uma ligação local.** Num teste, a aplicação MiBoxer e o adaptador estiveram ligados ao mesmo tempo; mas se a ligação falhar repetidamente, feche a aplicação nos telemóveis da mesma rede e não controle o gateway ao mesmo tempo com outras integrações locais (ioBroker.tuya, Home Assistant, tinytuya).

## Configuração

As definições da instância têm dois separadores: **Gateway** (ligação e controlo de zonas) e **Temporizadores** (ver [Temporizadores](#temporizadores)).

| Definição | Descrição |
| --- | --- |
| ID do dispositivo | ID do dispositivo Tuya do gateway WL-433 |
| Chave local | Chave local Tuya de 16 caracteres (guardada cifrada) |
| Endereço IP do gateway | Deixe vazio para encontrar o gateway automaticamente na rede local |
| Versão do protocolo Tuya | 3.3 para o WL-433 (3.1, 3.4 e 3.5 selecionáveis) |
| Procurar o gateway na rede local | Botão: encontra o gateway pelo ID do dispositivo e preenche o endereço IP e a versão do protocolo. Sem ID do dispositivo, são listados todos os dispositivos Tuya encontrados |
| Tempo até voltar a ligar | Segundos até tentar de novo uma ligação perdida ou falhada (predefinição 30) |
| Intervalo de atualização do estado | Segundos entre pedidos de estado completos (predefinição 60, 0 = apenas as atualizações enviadas pelo gateway) |
| Controlo de zonas | *Seletor de zona* (predefinição) ou *um canal por zona*, ver [Zonas](#zonas) |

## Zonas

O gateway controla até 8 zonas (como o comando FUT086). Cada comando pode ir para uma zona ou para todas, mas o gateway comunica **apenas um estado para todas as lâmpadas: a última definição, independentemente da zona para a qual foi enviada**. A aplicação MiBoxer também não mostra um estado próprio por zona. A definição *Controlo de zonas* oferece duas variantes:

| Variante | Estados | Adequado para |
| --- | --- | --- |
| **Seletor de zona (predefinição)** | `light.*` mostra o estado do gateway. `light.zone` (0 = todas as zonas, 1–8) seleciona a zona para a qual os comandos de `light.*` são enviados. | A maioria dos utilizadores: cada estado mostra o que o gateway comunica |
| **Um canal por zona** | `light.*` mostra o estado do gateway e envia para todas as zonas. Além disso, `zones.zone1` … `zones.zone8` controlam cada zona separadamente. Um canal de zona mostra os últimos valores enviados para essa zona e confirmados pelo gateway; fica vazio até ser enviado algo para a zona. | Scripts e visualizações que se dirigem diretamente às zonas |

Ao alterar a definição, os estados da outra variante são eliminados.

## Temporizadores

O separador **Temporizadores** das definições da instância contém até **50 temporizadores**. Funcionam localmente no adaptador, também sem Internet, e fazem mais do que os temporizadores da aplicação MiBoxer: eventos solares com desvio, desvio aleatório, época, zonas, cores, cenas e desligar após uma duração. Adicione um temporizador com **+**, abra-o para o alterar, copie-o ou elimine-o com os botões da entrada. As alterações entram em vigor quando as definições são guardadas (a instância reinicia).

| Campo | Descrição |
| --- | --- |
| Ativo | Desativa este temporizador sem o eliminar |
| Nome | Mostrado no registo e em `timers.overview` |
| Acionador | *Hora do dia* ou um evento solar: alvorada, nascer do sol, hora dourada (tarde), pôr do sol, crepúsculo, noite |
| Hora do dia | Apenas para o acionador *Hora do dia* |
| Desvio | Minutos (−720 a 720), negativo = mais cedo — p. ex. pôr do sol −15 |
| Desvio aleatório | Até ± minutos (0–120), sorteado de novo em cada execução — para uma simulação de presença |
| Dias da semana | Dias em que o temporizador é executado |
| Época de / até | `DD.MM.`, p. ex. `01.05.` a `30.09.`; uma época que atravessa a passagem de ano (`01.11.` a `28.02.`) também funciona; vazio = todo o ano |
| Zona | Todas as zonas ou zona 1–8 |
| Ação | Ligar, desligar, luz branca (temperatura de cor 2700–6500 K), cor, cena M1–M9, apenas brilho |
| Brilho | 1–100 %, vazio = sem alteração (não para *Desligar*) |
| Desligar após | Minutos (0–1440), 0 = não desligar (não para *Desligar*) |

- Os **eventos solares** são calculados a partir da posição nas definições de sistema do ioBroker (latitude e longitude) com [suncalc](https://github.com/mourner/suncalc). Sem posição, estes temporizadores são ignorados com um aviso. Nos dias sem o evento (regiões polares), o temporizador não é executado.
- Um temporizador envia os mesmos comandos que os estados: no modo de zonas *seletor de zona* para a sua zona (`light.zone` não é alterado), no modo *um canal por zona* através de `zones.zone<n>` (todas as zonas: `light.*`). O gateway confirma-os como qualquer comando.
- Se o gateway não estiver ligado quando um temporizador tiver de ser executado, essa execução é ignorada (aviso no registo) — não é repetida mais tarde.
- Os temporizadores com definições incompletas são ignorados; o registo e `timers.overview` indicam o motivo.
- As horas são horas locais do sistema ioBroker; a hora de verão é tida em conta.
- Os **temporizadores da aplicação MiBoxer** são guardados e executados na nuvem Tuya (apenas ligam ou desligam todas as zonas através do ponto de dados 20 e precisam de Internet). O adaptador não os pode ler nem alterar, mas vê o seu efeito no estado. Ambos os tipos de temporizadores podem ser usados ao mesmo tempo.

## Estados

| State | Descrição |
| --- | --- |
| `info.connection` | Ligação ao gateway |
| `info.ip` | Endereço IP utilizado para o gateway |
| `light.on` | Ligar / desligar |
| `light.mode` | `white`, `colour` ou `scene` — escrevê-lo muda o modo (modo de cor com o último tom, modo de cena com a última cena) |
| `light.brightness` | Brilho 1–100 % do modo atual. 0 desliga, um valor acima de 0 liga |
| `light.colorTemperature` | Temperatura de cor 2700–6500 K em passos de 100 K (muda para o modo branco) |
| `light.color` | Cor como `#rrggbb` com brilho máximo (muda para o modo de cor). Escrevê-la define o tom e a saturação, o brilho do valor RGB é ignorado — use `light.brightness` |
| `light.hue` | Tom 0–360° (muda para o modo de cor) |
| `light.saturation` | Saturação 0–100 % (muda para o modo de cor) |
| `light.scene` | Cena 1–9 (M1–M9 na aplicação), 0 = sem cena. Escrever 1–9 inicia a cena |
| `light.speedUp` / `light.speedDown` | Botões S+ / S- da aplicação: cena mais rápida / mais lenta. O gateway não comunica a velocidade |
| `light.countdown` | Segundos até o gateway comutar as lâmpadas (0 = desativado, ponto de dados padrão 26) |
| `light.zone` | Apenas com o seletor de zona: zona dos comandos `light.*`, 0 = todas as zonas, 1–8 |
| `zones.zone<n>.*` | Apenas com um canal por zona: `on`, `mode`, `brightness`, `colorTemperature`, `color`, `hue`, `saturation`, `scene`, `speedUp`, `speedDown` para a zona n |
| `dp101.raw` | Última trama do ponto de dados 101 em Base64 — escrevê-la envia o valor sem alterações |
| `dp101.hex` | Última trama do ponto de dados 101 em bytes hexadecimais — escrevê-la envia a trama, a soma de verificação é acrescentada ou corrigida automaticamente |
| `dp101.checksumValid` | A soma de verificação da última trama é válida |
| `dp101.history` | Lista JSON das últimas 50 tramas (`rx` = recebida, `tx` = enviada) com carimbo temporal; respostas de estado idênticas repetidas não são acrescentadas |
| `raw.dp<n>` | Qualquer outro ponto de dados comunicado pelo gateway é criado automaticamente (com escrita) |
| `settings.dmxAddress` | Endereço inicial 1–512 da entrada DMX512 do gateway – a partir dele, o gateway usa 5 canais: vermelho, verde, azul, branco frio, branco quente (menu *DMX* na aplicação). Escrevê-lo envia-o para a zona de `light.zone` (seletor de zona) ou para todas as zonas; o gateway confirma-o |
| `timers.active` | `false` pausa todos os temporizadores (p. ex. durante as férias ou a partir de um script), `true` volta a ativá-los |
| `timers.nextRun` | Próxima execução de um temporizador com o nome do temporizador (`paused (…)` enquanto `timers.active` for `false`) |
| `timers.lastRun` | Última execução de um temporizador com nome e ação |
| `timers.overview` | Lista JSON de todos os temporizadores: horário, ação, próxima execução, motivo se o temporizador for ignorado |

Os valores que precisam de um modo ou das lâmpadas ligadas são enviados como faz a aplicação MiBoxer: por exemplo, uma temperatura de cor no modo de cor muda primeiro para o modo branco, e um brilho com as lâmpadas desligadas liga-as primeiro. Alterações rápidas (p. ex. de um cursor) são agrupadas, só o último valor é enviado. Os comandos só são aceites enquanto o gateway está ligado. Um comando é considerado executado quando o estado seguinte do gateway mostra os seus valores (cerca de 2,5 s depois); até lá, o estado não está confirmado.

## Ponto de dados 101 — protocolo

O WL-433 transporta lâmpadas, zonas e cenas no ponto de dados 101 específico do fabricante: tramas de 12 bytes codificadas em Base64, o último byte é a soma de 8 bits dos bytes 0–10. O formato foi descodificado em 22/09/2026 a partir das tramas de estado de um gateway real e dos comandos que a aplicação MiBoxer escreve no seu registo Android:

| Trama | Bytes (hex) | Significado |
| --- | --- | --- |
| Comando (aplicação / adaptador → gateway) | `41 00 00 0B cc vv vv vv vv zz 80 ss` | `cc` comando: `01` tom 0–255 (valor nos bytes 5–8, muda para o modo de cor), `02` brilho 1–100 %, `03` temperatura de cor 0–38 (2700 K + 100 K por passo), `04` saturação 0–100 %, `05` cena 1–9, `06` tecla (`01` ligar, `02` desligar, `03` S-, `04` S+, `06` modo branco); `zz` zona: `00` todas, `01`–`08` |
| Pedido de estado | `43 00 00 80 00 00 00 00 00 80 80 C3` | o gateway responde com uma trama de estado `44` |
| Estado (gateway → aplicação) | `42` / `44` `00 00 00 mm hh tt bb ss 0B dd xx` | `42` relatório de alteração (cerca de 2,5 s após a última alteração), `44` resposta ao pedido; `mm` modo: `00` desligado, `01` cor, `02` branco, `03`–`0B` cena 1–9; `hh` tom, `tt` passo de temperatura de cor, `bb` brilho, `ss` saturação (0 no modo branco), `dd` byte baixo do endereço inicial DMX. A zona não faz parte do estado |
| Endereço inicial DMX | `49 00 00 0B 02 aa aa 00 00 zz 80 ss` | `aa aa` endereço 1–512 (byte alto, byte baixo), `zz` zona; resposta `49 00 00 0B 02 01 tt bb ss aa aa xx` |

A tecla `06 05` também desliga as lâmpadas (uma segunda vez mantém-nas desligadas, não alterna entre ligar e desligar); o que faz de diferente de `06 02` ainda é desconhecido, o adaptador não a usa. O gateway deriva os pontos de dados padrão 20–23 destes comandos; o adaptador usa apenas o ponto de dados 20 (ligar/desligar, chega antes do estado) e segue o estado do ponto de dados 101 para tudo o resto. Escrever o ponto de dados de cor Tuya 24 não muda a cor das lâmpadas — a aplicação MiBoxer também não o usa.

Acesso direto para as suas próprias experiências: `dp101.hex` aceita 11 bytes (a soma de verificação é acrescentada), p. ex. `43 00 00 80 00 00 00 00 00 80 80` pede o estado.

## Limitações

- O gateway comunica um único estado para todas as lâmpadas (a última definição) e não o estado de cada zona — ver [Zonas](#zonas).
- O gateway não comunica a velocidade de uma cena (S+ / S-).
- Não é possível ver se uma lâmpada recebeu de facto um comando por rádio: o estado vem do gateway.
- O gateway continua a comunicar o seu estado à nuvem Tuya. Bloquear completamente o seu acesso à Internet pode torná-lo pouco fiável. Os temporizadores da aplicação MiBoxer precisam da nuvem, os temporizadores do adaptador não.

## Registo e resolução de problemas

O adaptador regista segundo um esquema fixo, para que o registo seja sempre útil para localizar erros:

| Nível | O que é registado |
| --- | --- |
| error | Erros de configuração que impedem o adaptador de funcionar (falta o ID do dispositivo, chave local sem 16 caracteres) |
| warn | Problemas sobre os quais tem de agir — comunicados uma vez e depois só ao nível debug até serem resolvidos: o gateway recusa ligações, dados que não podem ser decifrados (chave local errada), comandos não confirmados pelo gateway, pedidos de estado sem resposta, valores de pontos de dados ou tramas de estado inesperados, temporizadores com definições incompletas ou sem posição para eventos solares, temporizadores que não conseguiram comutar as lâmpadas, um endereço inicial DMX não confirmado pelo gateway |
| info | Marcos: resumo da configuração no arranque, gateway encontrado, ligado, ligação perdida, ligação de novo estável, objetos da outra variante de zonas removidos, número de temporizadores ativos, temporizadores em pausa ou de novo ativos |
| debug | Cada passo com as suas entradas, decisões e durações: alteração de estado → tradução em tramas do ponto de dados 101 (com o motivo de tramas adicionais como «ligar primeiro») → fila de comandos → envio → confirmação pelo estado (ou qual valor ainda falta), cada ponto de dados e estado recebido e os estados atualizados, pedidos de estado, pesquisa, cada temporizador com o seu horário, próxima execução (evento solar, desvio, desvio aleatório) e execução. Os comandos (`#12`) e as tentativas de ligação (`Attempt #3`) são numerados, para que se possam seguir todas as linhas de um comando |
| silly | Adicionalmente, o rasto do protocolo da biblioteca tuyapi (pacotes, ping/pong) com a etiqueta `[tuyapi]` |

Cada mensagem começa com uma etiqueta de componente: `[cfg]` configuração, `[conn]` ligação, `[rx]` gateway → estados, `[cmd]` estados → comandos, `[queue]` fila de comandos, `[poll]` atualização e pedido de estado, `[disc]` pesquisa, `[dp101]` tramas em bruto, `[timer]` temporizadores, `[unload]` encerramento, `[tuyapi]` rasto da biblioteca. A chave local e as chaves de sessão nunca aparecem no registo — o resumo da configuração mostra apenas o comprimento da chave.

Para mudar o nível: Admin → **Instâncias** → modo de especialista → nível de registo de `miboxer-wl433.0` → `debug` (ou `silly` para o rasto do protocolo; depois reinicie a instância). Anexe um registo debug e o conteúdo de `dp101.history` quando comunicar um problema.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.2.0 (2026-09-22)

- (ssbingo) Temporizadores locais no novo separador *Temporizadores* das definições da instância (até 50): hora do dia ou evento solar com desvio e desvio aleatório, dias da semana, época, zona, qualquer ação de luz e desligar após uma duração; estados `timers.active`, `timers.nextRun`, `timers.lastRun` e `timers.overview`
- (ssbingo) O endereço inicial da entrada DMX512 do gateway pode ser lido e escrito (`settings.dmxAddress`)
- (ssbingo) Documentado: comando DMX, tecla `06 05`, temporizadores na nuvem da aplicação MiBoxer; manuais com um novo capítulo sobre temporizadores

### 0.1.0 (2026-09-22)

- (ssbingo) Ponto de dados 101 descodificado: lâmpadas, zonas e cenas são agora controladas com os comandos próprios do gateway (antes não era possível definir a cor), o estado é lido do ponto de dados 101 e pedido ativamente
- (ssbingo) Novos estados: tom, saturação, cena M1–M9, botões S+ / S-; zonas selecionáveis nas definições como seletor de zona (`light.zone`) ou um canal por zona
- (ssbingo) Os comandos são confirmados pelo estado do gateway, é registado um aviso se o gateway não os confirmar; saída debug detalhada para cada passo
- (ssbingo) Manual do utilizador em alemão e inglês para principiantes

### 0.0.1 (2026-09-21)

- (ssbingo) Primeira versão: controlo local do gateway WL-433 através do protocolo LAN da Tuya (ligar/desligar, modo, brilho, temperatura de cor, cor, contagem decrescente), acesso direto ao ponto de dados 101 com tratamento da soma de verificação e pesquisa do gateway na rede local, registo de depuração detalhado com etiquetas de componentes, números de comando e durações (segredos nunca são registados)

## Licença

Licença MIT — Copyright (c) 2026 ssbingo. O texto completo da licença encontra-se no [English README](../../README.md#license) e no ficheiro [LICENSE](../../LICENSE).
