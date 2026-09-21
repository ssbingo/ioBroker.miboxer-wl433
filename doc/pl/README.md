# ioBroker.miboxer-wl433

> [English README](../../README.md)

---

<p align="center">
  <a href="https://www.buymeacoffee.com/ssbingo"><img alt="Buy me a coffee" src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=ssbingo&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>
</p>

---

Lokalne sterowanie lampami basenowymi LoRa **MiBoxer PW01 / PW02** (433 MHz) przez bramkę **MiBoxer WL-433** — bez chmury, bez asystenta głosowego, bezpośrednio w Twojej sieci lokalnej.

Producent: [MiBoxer (Futlight Optoelectronics)](https://miboxer.com/) — [WL-433](https://miboxer.com/product/lora-433mhz-gateway), [PW01](https://miboxer.com/product/27w-rgbcct-par56-led-pool-light-lora-433mhz)

## Zastrzeżenie

To **nieoficjalny projekt społeczności**. **Nie jest powiązany** z Shenzhen Futlight Optoelectronics Co., Ltd. (MiBoxer / Mi-Light) ani z Tuya i nie jest przez nie wspierany. „MiBoxer”, „Mi-Light” i „Tuya” są znakami towarowymi ich właścicieli i służą wyłącznie do opisu kompatybilności urządzeń. Korzystasz na własne ryzyko.

## Zasada działania

W WL-433 znajduje się moduł Wi-Fi Tuya. W sieci lokalnej bramka jest **jednym** urządzeniem Tuya — wszystkie sparowane lampy są sterowane przez to urządzenie, a bramka przekazuje polecenia do lamp przez LoRa (433 MHz). Adapter komunikuje się bezpośrednio z bramką za pomocą **protokołu Tuya LAN 3.3** (port TCP 6668, szyfrowanie AES kluczem lokalnym), korzystając ze sprawdzonej biblioteki [tuyapi](https://github.com/codetheweb/tuyapi) (używanej również przez ioBroker.tuya). Obsługiwane są też wersje protokołu 3.1, 3.4 i 3.5, na wypadek gdyby aktualizacja oprogramowania je zmieniła.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

Badania (analiza protokołu, źródła, plan testów) są dostępne w języku niemieckim: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Instrukcja parowania lamp z bramką: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Obsługiwany sprzęt

| Urządzenie | Rola | Status |
| --- | --- | --- |
| MiBoxer WL-433 | Wymagana, adapter łączy się z nią | Protokół Tuya 3.3 potwierdzony przez użytkownika z identycznym sprzętem |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lampa sparowana z bramką | Urządzenie docelowe |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lampa sparowana z bramką | Ta sama rodzina produktów, powinna działać |
| MiBoxer UW01, UW02, UW03, RD-9L | Lampa sparowana z bramką | Nieprzetestowane |

## Wymagania

1. Bramka jest skonfigurowana w aplikacji MiBoxer, a lampy są z nią sparowane.
2. **ID urządzenia i klucz lokalny** bramki. Producent nie obsługuje platformy deweloperskiej Tuya dla WL-433, ale aplikacja MiBoxer zapisuje obie wartości w swoim dzienniku debugowania: na Androidzie odczytaj dziennik przeglądarką logcat, np. *LogFox*, podczas uruchamiania aplikacji i sterowania bramką. **Klucz lokalny zmienia się przy każdym ponownym parowaniu bramki** — wtedy trzeba go ponownie odczytać i wpisać.
3. Bramka jest osiągalna z ioBroker (ta sama sieć). Zalecana jest rezerwacja DHCP; bez skonfigurowanego adresu IP adapter znajduje bramkę na podstawie jej rozgłoszeń UDP (porty 6666/6667).
4. **Urządzenia Tuya akceptują tylko jedno połączenie lokalne.** Zamknij aplikację MiBoxer na telefonach w tej samej sieci i nie steruj bramką jednocześnie innymi integracjami lokalnymi (ioBroker.tuya, Home Assistant, tinytuya).

## Konfiguracja

| Ustawienie | Opis |
| --- | --- |
| ID urządzenia | ID Tuya bramki WL-433 |
| Klucz lokalny | 16-znakowy klucz lokalny Tuya (przechowywany w postaci zaszyfrowanej) |
| Adres IP bramki | Pozostaw puste, aby automatycznie znaleźć bramkę w sieci lokalnej |
| Wersja protokołu Tuya | 3.3 dla WL-433 (do wyboru 3.1, 3.4 i 3.5) |
| Szukaj bramki w sieci lokalnej | Przycisk: znajduje bramkę po ID urządzenia i wpisuje adres IP oraz wersję protokołu. Bez ID wyświetla wszystkie znalezione urządzenia Tuya |
| Opóźnienie ponownego połączenia | Liczba sekund do ponownej próby połączenia (domyślnie 30) |
| Interwał odświeżania stanu | Liczba sekund między pełnymi zapytaniami o stan (domyślnie 60, 0 = tylko aktualizacje wysyłane przez bramkę) |

## Stany

| State | Tuya DP | Opis |
| --- | --- | --- |
| `info.connection` | – | Połączenie z bramką |
| `info.ip` | – | Używany adres IP bramki |
| `light.on` | 20 | Włączanie/wyłączanie wszystkich lamp |
| `light.mode` | 21 | `white`, `colour`, `scene`, `music` |
| `light.brightness` | 22 / 24 | Jasność 0–100 %. W trybie koloru zmieniana jest jasność koloru (DP 24), w przeciwnym razie jasność bieli (DP 22). 0 wyłącza, wartość powyżej 0 włącza |
| `light.colorTemperature` | 23 | Temperatura barwowa 2700–6500 K (przełącza w tryb biały) |
| `light.color` | 24 | Kolor jako `#rrggbb` (przełącza w tryb koloru) |
| `light.countdown` | 26 | Liczba sekund do przełączenia lamp przez bramkę (0 = wył.) |
| `dp101.raw` | 101 | Ostatnia ramka DP 101 w Base64 — zapis wysyła wartość bez zmian |
| `dp101.hex` | 101 | Ostatnia ramka DP 101 jako bajty hex — zapis wysyła ramkę, suma kontrolna jest dodawana lub poprawiana automatycznie |
| `dp101.checksumValid` | 101 | Suma kontrolna ostatniej ramki jest poprawna |
| `dp101.history` | 101 | Lista JSON ostatnich 50 ramek (`rx` = odebrana, `tx` = wysłana) ze znacznikiem czasu |
| `raw.dp<n>` | n | Każdy kolejny punkt danych zgłoszony przez bramkę jest tworzony automatycznie (zapisywalny) |

Szybkie zmiany (np. z suwaka) są łączone w jedno polecenie. Polecenia są przyjmowane tylko wtedy, gdy bramka jest połączona.

## Punkt danych 101 — strefy i sceny

WL-433 przesyła polecenia stref i scen w specyficznym dla producenta punkcie danych 101: 12-bajtowe ramki binarne zakodowane w Base64, ostatni bajt to 8-bitowa suma bajtów 0–10. Znaczenie pozostałych bajtów **nie zostało jeszcze odkodowane**. Do tego czasu adapter zapewnia bezpośredni dostęp:

- odebrane ramki pojawiają się w `dp101.raw` / `dp101.hex` i są zapisywane w `dp101.history`,
- ramki można wysyłać przez `dp101.hex` — wystarczy 11 bajtów, suma kontrolna jest dodawana automatycznie, np. `43 00 00 80 00 00 00 00 00 80 80`

**Potrzebna pomoc:** wykonuj w aplikacji MiBoxer po jednej czynności (dla każdej strefy: wł., wył., kolor, scena 1–9) i zapisuj ramki z `dp101.history`. Przy wystarczającej liczbie nagrań ramki będzie można odkodować i dodać osobne stany dla stref i scen. Procedurę opisuje rozdział 6 analizy protokołu.

## Ograniczenia

- Standardowe punkty danych 20–26 działają na wszystkie lampy bramki (być może tylko na strefę wybraną w aplikacji). Osobne strefy i sceny pojawią się po odkodowaniu punktu danych 101.
- Bramka nadal zgłasza swój stan do chmury Tuya. Całkowite zablokowanie dostępu do internetu może sprawić, że będzie działać niestabilnie.
- Ta pierwsza wersja została przetestowana z symulacją bramki (protokół Tuya 3.3). Opinie z prawdziwym sprzętem są bardzo mile widziane.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.0.1 (2026-09-21)

- (ssbingo) Pierwsze wydanie: lokalne sterowanie bramką WL-433 przez protokół LAN Tuya (wł./wył., tryb, jasność, temperatura barwowa, kolor, odliczanie), bezpośredni dostęp do punktu danych 101 z obsługą sumy kontrolnej i wyszukiwanie bramki w sieci lokalnej

## Licencja

Licencja MIT — Copyright (c) 2026 ssbingo. Pełny tekst licencji znajduje się w [English README](../../README.md#license) oraz w pliku [LICENSE](../../LICENSE).
