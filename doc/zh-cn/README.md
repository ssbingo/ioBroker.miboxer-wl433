# ioBroker.miboxer-wl433

> [English README](../../README.md)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

通过 **MiBoxer WL-433** 网关在本地控制 **MiBoxer PW01 / PW02** LoRa 泳池灯（433 MHz）——无需云端、无需语音助手，直接在您的局域网中运行。

制造商: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — [WL-433](https://miboxer.com/product/lora-433mhz-gateway), [PW01](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz)

## 免责声明

这是一个**非官方社区项目**，与 Shenzhen Futlight Optoelectronics Co., Ltd.（MiBoxer / Mi-Light）或涂鸦（Tuya）**没有任何关联**，也未获得其支持或认可。“MiBoxer”、“Mi-Light”和“Tuya”是其各自所有者的商标，仅用于说明设备兼容性。使用风险自负。

## 工作原理

WL-433 内置涂鸦 Wi-Fi 模块。在局域网中，网关是**一个**涂鸦设备——所有已连接的灯具都通过该设备控制，网关再通过 LoRa（433 MHz）将命令发送给灯具。适配器使用**涂鸦局域网协议 3.3**（TCP 端口 6668，使用本地密钥进行 AES 加密）直接与网关通信，基于成熟的 [tuyapi](https://github.com/codetheweb/tuyapi) 库（ioBroker.tuya 也在使用）。如果固件更新改变了协议版本，也支持 3.1、3.4 和 3.5 版本。

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

背景研究（协议分析、资料来源、测试计划）提供德语版本：[Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md)（[PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)）。灯具与网关配对指南：[Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf)。

## 支持的硬件

| 设备 | 作用 | 状态 |
| --- | --- | --- |
| MiBoxer WL-433 | 必需，适配器与其连接 | 已由拥有相同硬件的用户确认使用涂鸦协议 3.3 |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | 已与网关配对的灯具 | 目标设备 |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | 已与网关配对的灯具 | 同一产品系列，预计可用 |
| MiBoxer UW01, UW02, UW03, RD-9L | 已与网关配对的灯具 | 未测试 |

## 前提条件

1. 网关已在 MiBoxer 应用中设置，灯具已与其配对。
2. 网关的**设备 ID 和本地密钥**。制造商不支持 WL-433 使用涂鸦开发者平台，但 MiBoxer 应用会将这两个值写入调试日志：在 Android 上，在应用启动并控制网关时使用 *LogFox* 等 logcat 查看器读取日志。**每次重新配对网关后本地密钥都会改变**——此时需要重新读取并填写。
3. ioBroker 可以访问网关（同一网络）。建议为网关设置 DHCP 保留地址；未配置 IP 地址时，适配器会通过网关的 UDP 广播（端口 6666/6667）找到它。
4. **涂鸦设备只接受一个本地连接。** 请关闭同一网络中手机上的 MiBoxer 应用，并且不要同时使用其他本地集成（ioBroker.tuya、Home Assistant、tinytuya）控制网关。

## 配置

| 设置 | 说明 |
| --- | --- |
| 设备 ID | WL-433 网关的涂鸦设备 ID |
| 本地密钥 | 16 个字符的涂鸦本地密钥（加密存储） |
| 网关 IP 地址 | 留空则在局域网中自动查找网关 |
| 涂鸦协议版本 | WL-433 使用 3.3（可选 3.1、3.4 和 3.5） |
| 在局域网中搜索网关 | 按钮：根据设备 ID 查找网关并填写 IP 地址和协议版本。未填写设备 ID 时列出找到的所有涂鸦设备 |
| 重新连接延迟 | 重新尝试连接前等待的秒数（默认 30） |
| 状态刷新间隔 | 两次完整状态查询之间的秒数（默认 60，0 = 仅使用网关推送的更新） |

## 状态

| State | Tuya DP | 说明 |
| --- | --- | --- |
| `info.connection` | – | 与网关的连接 |
| `info.ip` | – | 网关使用的 IP 地址 |
| `light.on` | 20 | 打开/关闭所有灯具 |
| `light.mode` | 21 | `white`, `colour`, `scene`, `music` |
| `light.brightness` | 22 / 24 | 亮度 0–100 %。彩色模式下调整颜色亮度（DP 24），否则调整白光亮度（DP 22）。0 表示关闭，大于 0 的值会打开灯具 |
| `light.colorTemperature` | 23 | 色温 2700–6500 K（切换到白光模式） |
| `light.color` | 24 | 颜色，格式为 `#rrggbb`（切换到彩色模式） |
| `light.countdown` | 26 | 网关切换灯具前的秒数（0 = 关闭） |
| `dp101.raw` | 101 | 最后一个 DP 101 帧（Base64）——写入时原样发送 |
| `dp101.hex` | 101 | 最后一个 DP 101 帧（十六进制字节）——写入时发送该帧，校验和自动补全或更正 |
| `dp101.checksumValid` | 101 | 最后一帧的校验和有效 |
| `dp101.history` | 101 | 最近 50 帧的 JSON 列表（`rx` = 接收，`tx` = 发送），带时间戳 |
| `raw.dp<n>` | n | 网关报告的其他数据点会自动创建（可写） |

快速变化（例如来自滑块）会合并为一条命令。仅在网关已连接时才接受命令。

## 数据点 101——区域和场景

WL-433 通过厂商专用的数据点 101 传输区域和场景命令：12 字节的二进制帧，经 Base64 编码，最后一个字节是第 0–10 字节的 8 位校验和。其余字节的含义**尚未解码**。在此之前，适配器提供原始访问：

- 接收到的帧显示在 `dp101.raw` / `dp101.hex` 中，并记录在 `dp101.history` 中，
- 可以通过 `dp101.hex` 发送帧——只需 11 个字节，校验和会自动附加，例如 `43 00 00 80 00 00 00 00 00 80 80`

**欢迎协助：** 在 MiBoxer 应用中每次只执行一个操作（每个区域：打开、关闭、颜色、场景 1–9），并记录 `dp101.history` 中的帧。有足够的记录后即可解码这些帧，并添加专门的区域和场景状态。具体步骤见协议分析第 6 章。

## 限制

- 标准数据点 20–26 作用于网关的所有灯具（可能仅作用于应用中选定的区域）。数据点 101 解码后将提供独立的区域和场景控制。
- 网关仍会向涂鸦云报告其状态。完全阻止其访问互联网可能导致其运行不稳定。
- 首个版本已在网关模拟环境（涂鸦协议 3.3）中测试。非常欢迎提供真实硬件的使用反馈。

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) 首个版本：通过涂鸦局域网协议本地控制 WL-433 网关（开/关、模式、亮度、色温、颜色、倒计时），可直接访问数据点 101 并处理校验和，支持在局域网中搜索网关，带组件标签、命令编号和耗时的详细调试日志（从不记录密钥）

## 许可证

MIT 许可证——Copyright (c) 2026 ssbingo。完整许可证文本见 [English README](../../README.md#license) 和 [LICENSE](../../LICENSE) 文件。
