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

W WL-433 znajduje się moduł Wi-Fi Tuya. W sieci lokalnej bramka jest **jednym** urządzeniem Tuya — wszystkie powiązane lampy są sterowane przez to jedno urządzenie, a bramka przekazuje polecenia do lamp przez LoRa (433 MHz). Adapter komunikuje się z bramką bezpośrednio za pomocą **protokołu LAN Tuya 3.3** (port TCP 6668, szyfrowanie AES kluczem lokalnym), w oparciu o sprawdzoną bibliotekę [tuyapi](https://github.com/codetheweb/tuyapi) (używaną też przez ioBroker.tuya). Obsługiwane są również wersje protokołu 3.1, 3.4 i 3.5, na wypadek gdyby aktualizacja oprogramowania ją zmieniła.

Lampy, strefy i sceny są sterowane własnymi poleceniami bramki w specyficznym dla producenta **punkcie danych 101** — tymi samymi poleceniami, które wysyła aplikacja MiBoxer. Bramka zgłasza swój stan w ten sam sposób; adapter dodatkowo odpytuje go przy łączeniu i przy każdym odświeżeniu stanu.

```text
ioBroker ──LAN: Tuya 3.3, TCP 6668──► WL-433 ──LoRa 433 MHz──► PW01 / PW02
```

**Podręcznik użytkownika** z każdym krokiem wyjaśnionym dla początkujących (instalacja, ustawienia, strefy, timery, przykłady, rozwiązywanie problemów): [English](../Manual_miboxer-wl433.md) ([PDF](../Manual_miboxer-wl433.pdf)) · [Deutsch](../Handbuch_miboxer-wl433.md) ([PDF](../Handbuch_miboxer-wl433.pdf)).

Badania źródłowe (analiza protokołu, źródła, plan testów, rozszyfrowany punkt danych 101), po niemiecku: [Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.md) ([PDF](../Miboxer_WL-433_PW01_Protokollanalyse_lokale_Steuerung.pdf)). Poradnik łączenia lamp z bramką: [Anleitung_PW01_mit_WL-433_verbinden.pdf](../Anleitung_PW01_mit_WL-433_verbinden.pdf).

## Obsługiwany sprzęt

| Urządzenie | Rola | Status |
| --- | --- | --- |
| MiBoxer WL-433 | Wymagana, adapter się z nią łączy | Przetestowano z prawdziwą bramką (protokół Tuya 3.3, punkt danych 101) |
| MiBoxer PW01 (27 W RGB+CCT PAR56) | Lampa powiązana z bramką | Urządzenie docelowe |
| MiBoxer PW02 (18 W RGB+CCT PAR56) | Lampa powiązana z bramką | Ta sama rodzina produktów, powinna działać |
| MiBoxer UW01, UW02, UW03, RD-9L | Lampa powiązana z bramką | Nieprzetestowane |

## Wymagania

1. Bramka jest skonfigurowana w aplikacji MiBoxer, a lampy są z nią powiązane.
2. **ID urządzenia i klucz lokalny** bramki. Producent nie obsługuje platformy deweloperskiej Tuya dla WL-433, ale aplikacja MiBoxer zapisuje obie wartości w swoim dzienniku debugowania: na Androidzie odczytaj dziennik przeglądarką logcat, np. *LogFox*, podczas gdy aplikacja uruchamia się i steruje bramką. **Klucz lokalny zmienia się przy każdym ponownym parowaniu bramki** — wtedy trzeba go ponownie odczytać i wpisać. Poradnik krok po kroku dla początkujących (po niemiecku, dla Androida, iPhone'a i iPada): [Anleitung_Geraete-ID_und_Local-Key_auslesen.md](../Anleitung_Geraete-ID_und_Local-Key_auslesen.md) ([PDF](../Anleitung_Geraete-ID_und_Local-Key_auslesen.pdf)).
3. Bramka jest osiągalna z ioBroker (ta sama sieć). Zalecana jest rezerwacja DHCP; bez skonfigurowanego adresu IP adapter znajduje bramkę dzięki jej rozgłoszeniom UDP (porty 6666/6667).
4. **Urządzenia Tuya zazwyczaj akceptują tylko jedno połączenie lokalne.** W teście aplikacja MiBoxer i adapter były połączone jednocześnie; jeśli jednak połączenie wciąż się nie udaje, zamknij aplikację na telefonach w tej samej sieci i nie steruj bramką jednocześnie innymi integracjami lokalnymi (ioBroker.tuya, Home Assistant, tinytuya).

## Konfiguracja

Ustawienia instancji mają dwie zakładki: **Bramka** (połączenie i sterowanie strefami) oraz **Timery** (zob. [Timery](#timery)).

| Ustawienie | Opis |
| --- | --- |
| ID urządzenia | ID urządzenia Tuya bramki WL-433 |
| Klucz lokalny | 16-znakowy klucz lokalny Tuya (przechowywany zaszyfrowany) |
| Adres IP bramki | Pozostaw puste, aby automatycznie znaleźć bramkę w sieci lokalnej |
| Wersja protokołu Tuya | 3.3 dla WL-433 (do wyboru 3.1, 3.4 i 3.5) |
| Szukaj bramki w sieci lokalnej | Przycisk: znajduje bramkę po ID urządzenia i wpisuje adres IP oraz wersję protokołu. Bez ID urządzenia wyświetlane są wszystkie znalezione urządzenia Tuya |
| Czas do ponownego połączenia | Sekundy do ponownej próby utraconego lub nieudanego połączenia (domyślnie 30) |
| Interwał odświeżania stanu | Sekundy między pełnymi zapytaniami o stan (domyślnie 60, 0 = tylko aktualizacje wysyłane przez bramkę) |
| Sterowanie strefami | *Wybór strefy* (domyślnie) lub *jeden kanał na strefę*, zob. [Strefy](#strefy) |

## Strefy

Bramka steruje maksymalnie 8 strefami (jak pilot FUT086). Każde polecenie może trafić do jednej strefy lub do wszystkich, ale bramka zgłasza **tylko jeden stan dla wszystkich lamp: ostatnie ustawienie, niezależnie od tego, do której strefy zostało wysłane**. Również aplikacja MiBoxer nie pokazuje osobnego stanu dla każdej strefy. Ustawienie *Sterowanie strefami* oferuje dwa warianty:

| Wariant | Stany | Odpowiedni dla |
| --- | --- | --- |
| **Wybór strefy (domyślnie)** | `light.*` pokazuje stan bramki. `light.zone` (0 = wszystkie strefy, 1–8) wybiera strefę, do której trafiają polecenia `light.*`. | Większość użytkowników: każdy stan pokazuje to, co zgłasza bramka |
| **Jeden kanał na strefę** | `light.*` pokazuje stan bramki i wysyła do wszystkich stref. Dodatkowo `zones.zone1` … `zones.zone8` sterują każdą strefą osobno. Kanał strefy pokazuje ostatnie wartości wysłane do tej strefy i potwierdzone przez bramkę; pozostaje pusty, dopóki nic nie zostanie wysłane do strefy. | Skrypty i wizualizacje, które adresują strefy bezpośrednio |

Po zmianie ustawienia stany drugiego wariantu są usuwane.

## Timery

Zakładka **Timery** w ustawieniach instancji mieści do **50 timerów**. Działają one lokalnie w adapterze, także bez internetu, i potrafią więcej niż timery aplikacji MiBoxer: zdarzenia słoneczne z przesunięciem, losowe odchylenie, sezon, strefy, kolory, sceny i wyłączanie po określonym czasie. Dodaj timer przyciskiem **+**, otwórz go, aby go zmienić, kopiuj lub usuwaj go przyciskami wpisu. Zmiany zaczynają obowiązywać po zapisaniu ustawień (instancja uruchamia się ponownie).

| Pole | Opis |
| --- | --- |
| Aktywny | Wyłącza ten timer bez usuwania go |
| Nazwa | Wyświetlana w dzienniku i w `timers.overview` |
| Wyzwalacz | *Godzina* lub zdarzenie słoneczne: świt, wschód słońca, złota godzina (wieczór), zachód słońca, zmierzch, noc |
| Godzina | Tylko dla wyzwalacza *Godzina* |
| Przesunięcie | Minuty (od −720 do 720), wartość ujemna = wcześniej — np. zachód słońca −15 |
| Losowe odchylenie | Do ± minut (0–120), losowane na nowo przy każdym uruchomieniu — do symulacji obecności |
| Dni tygodnia | Dni, w które timer działa |
| Sezon od / do | `DD.MM.`, np. od `01.05.` do `30.09.`; sezon obejmujący przełom roku (od `01.11.` do `28.02.`) również działa; puste = cały rok |
| Strefa | Wszystkie strefy lub strefa 1–8 |
| Akcja | Włącz, wyłącz, białe światło (temperatura barwowa 2700–6500 K), kolor, scena M1–M9, tylko jasność |
| Jasność | 1–100 %, puste = bez zmian (nie dla akcji *Wyłącz*) |
| Wyłącz po | Minuty (0–1440), 0 = nie wyłączaj (nie dla akcji *Wyłącz*) |

- **Zdarzenia słoneczne** są obliczane na podstawie położenia z ustawień systemowych ioBroker (szerokość i długość geograficzna) za pomocą [suncalc](https://github.com/mourner/suncalc). Bez położenia takie timery są ignorowane z ostrzeżeniem. W dni, w których zdarzenie nie występuje (regiony polarne), timer nie działa.
- Timer wysyła te same polecenia co stany: w wariancie sterowania strefami *wybór strefy* do swojej strefy (`light.zone` nie jest zmieniany), w wariancie *jeden kanał na strefę* przez `zones.zone<n>` (wszystkie strefy: `light.*`). Bramka potwierdza je jak każde inne polecenie.
- Jeśli w chwili, gdy timer ma zadziałać, bramka nie jest połączona, to uruchomienie jest pomijane (ostrzeżenie w dzienniku) — nie jest powtarzane później.
- Timery z niekompletnymi ustawieniami są ignorowane; dziennik i `timers.overview` podają powód.
- Czasy są czasem lokalnym systemu ioBroker; czas letni jest uwzględniany.
- **Timery aplikacji MiBoxer** są przechowywane i wykonywane w chmurze Tuya (tylko włączają lub wyłączają wszystkie strefy przez punkt danych 20 i wymagają internetu). Adapter nie może ich odczytać ani zmienić, ale widzi ich skutek w stanie. Oba rodzaje timerów mogą działać jednocześnie.

## Stany

| State | Opis |
| --- | --- |
| `info.connection` | Połączenie z bramką |
| `info.ip` | Adres IP używany dla bramki |
| `light.on` | Wł. / wył. |
| `light.mode` | `white`, `colour` lub `scene` — zapis zmienia tryb (tryb koloru z ostatnim odcieniem, tryb sceny z ostatnią sceną) |
| `light.brightness` | Jasność 1–100 % bieżącego trybu. 0 wyłącza, wartość powyżej 0 włącza |
| `light.colorTemperature` | Temperatura barwowa 2700–6500 K w krokach co 100 K (przełącza na tryb biały) |
| `light.color` | Kolor jako `#rrggbb` przy pełnej jasności (przełącza na tryb koloru). Zapis ustawia odcień i nasycenie, jasność wartości RGB jest ignorowana — użyj `light.brightness` |
| `light.hue` | Odcień 0–360° (przełącza na tryb koloru) |
| `light.saturation` | Nasycenie 0–100 % (przełącza na tryb koloru) |
| `light.scene` | Scena 1–9 (M1–M9 w aplikacji), 0 = brak sceny. Zapis 1–9 uruchamia scenę |
| `light.speedUp` / `light.speedDown` | Przyciski S+ / S- aplikacji: scena szybciej / wolniej. Bramka nie zgłasza prędkości |
| `light.countdown` | Sekundy do przełączenia lamp przez bramkę (0 = wył., standardowy punkt danych 26) |
| `light.zone` | Tylko przy wyborze strefy: strefa poleceń `light.*`, 0 = wszystkie strefy, 1–8 |
| `zones.zone<n>.*` | Tylko przy jednym kanale na strefę: `on`, `mode`, `brightness`, `colorTemperature`, `color`, `hue`, `saturation`, `scene`, `speedUp`, `speedDown` dla strefy n |
| `dp101.raw` | Ostatnia ramka punktu danych 101 jako Base64 — zapis wysyła wartość bez zmian |
| `dp101.hex` | Ostatnia ramka punktu danych 101 jako bajty szesnastkowe — zapis wysyła ramkę, suma kontrolna jest dodawana lub poprawiana automatycznie |
| `dp101.checksumValid` | Suma kontrolna ostatniej ramki jest poprawna |
| `dp101.history` | Lista JSON ostatnich 50 ramek (`rx` = odebrana, `tx` = wysłana) ze znacznikiem czasu; powtarzające się identyczne odpowiedzi stanu nie są dodawane |
| `raw.dp<n>` | Każdy kolejny punkt danych zgłoszony przez bramkę jest tworzony automatycznie (z możliwością zapisu) |
| `settings.dmxAddress` | Adres startowy 1–512 wejścia DMX512 bramki – od niego bramka wykorzystuje 5 kanałów: czerwony, zielony, niebieski, zimna biel, ciepła biel (menu *DMX* w aplikacji). Zapis wysyła go do strefy z `light.zone` (wybór strefy) lub do wszystkich stref; bramka go potwierdza |
| `timers.active` | `false` wstrzymuje wszystkie timery (np. na czas urlopu lub ze skryptu), `true` ponownie je uruchamia |
| `timers.nextRun` | Następne uruchomienie timera z nazwą timera (`paused (…)`, gdy `timers.active` ma wartość `false`) |
| `timers.lastRun` | Ostatnie uruchomienie timera z nazwą i akcją |
| `timers.overview` | Lista JSON wszystkich timerów: harmonogram, akcja, następne uruchomienie, powód, jeśli timer jest ignorowany |

Wartości wymagające określonego trybu lub włączonych lamp adapter wysyła tak jak aplikacja MiBoxer: np. temperatura barwowa w trybie koloru najpierw przełącza na tryb biały, a jasność przy wyłączonych lampach najpierw je włącza. Szybkie zmiany (np. z suwaka) są łączone, wysyłana jest tylko ostatnia wartość. Polecenia są przyjmowane tylko wtedy, gdy bramka jest połączona. Polecenie uznaje się za wykonane, gdy następny stan bramki pokazuje jego wartości (około 2,5 s później); do tego czasu stan nie jest potwierdzony.

## Punkt danych 101 — protokół

WL-433 przesyła lampy, strefy i sceny w specyficznym dla producenta punkcie danych 101: 12-bajtowe ramki zakodowane w Base64, ostatni bajt to 8-bitowa suma bajtów 0–10. Format został rozszyfrowany 22.09.2026 na podstawie ramek stanu prawdziwej bramki i poleceń, które aplikacja MiBoxer zapisuje w swoim dzienniku Androida:

| Ramka | Bytes (hex) | Znaczenie |
| --- | --- | --- |
| Polecenie (aplikacja / adapter → bramka) | `41 00 00 0B cc vv vv vv vv zz 80 ss` | `cc` polecenie: `01` odcień 0–255 (wartość w bajtach 5–8, przełącza na tryb koloru), `02` jasność 1–100 %, `03` temperatura barwowa 0–38 (2700 K + 100 K na krok), `04` nasycenie 0–100 %, `05` scena 1–9, `06` klawisz (`01` wł., `02` wył., `03` S-, `04` S+, `06` tryb biały); `zz` strefa: `00` wszystkie, `01`–`08` |
| Zapytanie o stan | `43 00 00 80 00 00 00 00 00 80 80 C3` | bramka odpowiada ramką stanu `44` |
| Stan (bramka → aplikacja) | `42` / `44` `00 00 00 mm hh tt bb ss 0B dd xx` | `42` zgłoszenie zmiany (około 2,5 s po ostatniej zmianie), `44` odpowiedź na zapytanie; `mm` tryb: `00` wył., `01` kolor, `02` biały, `03`–`0B` scena 1–9; `hh` odcień, `tt` krok temperatury barwowej, `bb` jasność, `ss` nasycenie (0 w trybie białym), `dd` młodszy bajt adresu startowego DMX. Strefa nie jest częścią stanu |
| Adres startowy DMX | `49 00 00 0B 02 aa aa 00 00 zz 80 ss` | `aa aa` adres 1–512 (starszy bajt, młodszy bajt), `zz` strefa; odpowiedź `49 00 00 0B 02 01 tt bb ss aa aa xx` |

Klawisz `06 05` również wyłącza lampy (naciśnięty drugi raz pozostawia je wyłączone, nie jest przełącznikiem); czym różni się od `06 02`, wciąż nie wiadomo, adapter go nie używa. Standardowe punkty danych 20–23 bramka wyprowadza z tych poleceń; adapter używa tylko punktu danych 20 (wł./wył., przychodzi wcześniej niż stan), a we wszystkim innym podąża za stanem z punktu danych 101. Zapis punktu danych koloru Tuya 24 nie zmienia koloru lamp — aplikacja MiBoxer również go nie używa.

Surowy dostęp do własnych eksperymentów: `dp101.hex` przyjmuje 11 bajtów (suma kontrolna jest dodawana), np. `43 00 00 80 00 00 00 00 00 80 80` pyta o stan.

## Ograniczenia

- Bramka zgłasza jeden stan dla wszystkich lamp (ostatnie ustawienie), a nie stan każdej strefy — zob. [Strefy](#strefy).
- Bramka nie zgłasza prędkości sceny (S+ / S-).
- Nie widać, czy lampa rzeczywiście odebrała polecenie drogą radiową: stan pochodzi z bramki.
- Bramka nadal zgłasza swój stan do chmury Tuya. Całkowite zablokowanie jej dostępu do internetu może sprawić, że będzie działać zawodnie. Timery aplikacji MiBoxer potrzebują chmury, timery adaptera — nie.

## Logowanie i rozwiązywanie problemów

Adapter loguje według stałego schematu, aby dziennik był w każdej chwili przydatny do szukania błędów:

| Poziom | Co jest logowane |
| --- | --- |
| error | Błędy konfiguracji, przez które adapter nie może działać (brak ID urządzenia, klucz lokalny nie ma 16 znaków) |
| warn | Problemy wymagające Twojego działania — zgłaszane raz, a potem tylko na poziomie debug, dopóki nie zostaną rozwiązane: bramka odrzuca połączenia, dane niemożliwe do odszyfrowania (zły klucz lokalny), polecenia niepotwierdzone przez bramkę, zapytania o stan bez odpowiedzi, nieoczekiwane wartości punktów danych lub ramki stanu, timery z niekompletnymi ustawieniami lub bez położenia dla zdarzeń słonecznych, timery, które nie mogły przełączyć lamp, adres startowy DMX niepotwierdzony przez bramkę |
| info | Kamienie milowe: podsumowanie konfiguracji przy starcie, bramka znaleziona, połączona, połączenie utracone, połączenie znów stabilne, obiekty drugiego wariantu stref usunięte, liczba aktywnych timerów, timery wstrzymane lub ponownie aktywne |
| debug | Każdy krok z danymi wejściowymi, decyzjami i czasami: zmiana stanu → przełożenie na ramki punktu danych 101 (z powodem dodatkowych ramek, np. „najpierw włącz”) → kolejka poleceń → wysłanie → potwierdzenie przez stan (lub której wartości jeszcze brakuje), każdy odebrany punkt danych i stan oraz zaktualizowane stany, zapytania o stan, wyszukiwanie, każdy timer z harmonogramem, następnym uruchomieniem (zdarzenie słoneczne, przesunięcie, losowe odchylenie) i wykonaniem. Polecenia (`#12`) i próby połączenia (`Attempt #3`) są numerowane, dzięki czemu można prześledzić wszystkie wiersze jednego polecenia |
| silly | Dodatkowo ślad protokołu biblioteki tuyapi (pakiety, ping/pong) z etykietą `[tuyapi]` |

Każdy komunikat zaczyna się od etykiety: `[cfg]` konfiguracja, `[conn]` połączenie, `[rx]` bramka → stany, `[cmd]` stany → polecenia, `[queue]` kolejka poleceń, `[poll]` odświeżanie i zapytanie o stan, `[disc]` wyszukiwanie, `[dp101]` surowe ramki, `[timer]` timery, `[unload]` zamykanie, `[tuyapi]` ślad biblioteki. Klucz lokalny i klucze sesji nigdy nie pojawiają się w dzienniku — podsumowanie konfiguracji pokazuje tylko długość klucza.

Zmiana poziomu: Admin → **Instancje** → tryb eksperta → poziom logowania `miboxer-wl433.0` → `debug` (lub `silly` dla śladu protokołu; następnie uruchom instancję ponownie). Przy zgłaszaniu problemu dołącz dziennik debug i zawartość `dp101.history`.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### 0.2.0 (2026-09-22)

- (ssbingo) Lokalne timery w nowej zakładce *Timery* ustawień instancji (do 50): godzina lub zdarzenie słoneczne z przesunięciem i losowym odchyleniem, dni tygodnia, sezon, strefa, każda akcja oświetlenia i wyłączanie po określonym czasie; stany `timers.active`, `timers.nextRun`, `timers.lastRun` i `timers.overview`
- (ssbingo) Adres startowy wejścia DMX512 bramki do odczytu i zapisu (`settings.dmxAddress`)
- (ssbingo) Udokumentowano: polecenie DMX, klawisz `06 05`, timery chmurowe aplikacji MiBoxer; podręczniki z nowym rozdziałem o timerach

### 0.1.0 (2026-09-22)

- (ssbingo) Rozszyfrowano punkt danych 101: lampy, strefy i sceny są teraz sterowane własnymi poleceniami bramki (wcześniej nie dało się ustawić koloru), stan jest odczytywany z punktu danych 101 i aktywnie odpytywany
- (ssbingo) Nowe stany: odcień, nasycenie, scena M1–M9, przyciski S+ / S-; strefy do wyboru w ustawieniach jako wybór strefy (`light.zone`) lub jeden kanał na strefę
- (ssbingo) Polecenia są potwierdzane przez stan bramki, a gdy bramka ich nie potwierdzi, logowane jest ostrzeżenie; szczegółowe wyjście debug dla każdego kroku
- (ssbingo) Podręcznik użytkownika po niemiecku i angielsku dla początkujących

### 0.0.1 (2026-09-21)

- (ssbingo) Pierwsze wydanie: lokalne sterowanie bramką WL-433 przez protokół LAN Tuya (wł./wył., tryb, jasność, temperatura barwowa, kolor, odliczanie), bezpośredni dostęp do punktu danych 101 z obsługą sumy kontrolnej i wyszukiwanie bramki w sieci lokalnej, szczegółowe logowanie debugowania z etykietami komponentów, numerami poleceń i czasami trwania (sekrety nigdy nie są logowane)

## Licencja

Licencja MIT — Copyright (c) 2026 ssbingo. Pełny tekst licencji znajduje się w [English README](../../README.md#license) oraz w pliku [LICENSE](../../LICENSE).
