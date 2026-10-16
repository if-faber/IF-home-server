# IF-startpage

Samodzielna, lekka strona startowa domowego serwera: Strona Główna z kafelkami usług,
Zaplecze administracyjne chronione PIN-em i Kiosk statusu serwera.
Część pakietu **Idea Forge** dla serwerów domowych.

> **Nazwa:** projekt nazywa się `IF-startpage`, a nie „Homepage”, żeby nie mylić go
> z istniejącym projektem open source o tej nazwie (gethomepage.dev) ani z innymi
> dashboardami tej niszy (Homarr, Heimdall, Dashy, Homer, Flame).

## Część IF-home-server

Od wersji 0.3.0 strona startowa jest częścią projektu
[`IF-home-server`](https://github.com/if-faber/IF-home-server) (ten folder: `strona/`).
Serwer (program `if-server`), Dockge i strona instalują się razem i poprawnie — bez ręcznego
łączenia. Druga cyfra wersji jest wspólna z serwerem (np. 0.3), trzecia to poprawki samej
strony (0.3.1, 0.3.2…).

## Funkcje

- **Strona Główna** — własne strony w menu (Home + dowolne, np. Ulubione), na nich sekcje
  z kafelkami linków, stałe strony serwera (Status, Top, Narzędzia, Alerty), tryb dzień/noc
  (przełącznik ☀️/🌙 na dole paska bocznego), menu ⚙️ w pasku bocznym (wygląd na żywo,
  Zaplecze, blokada edycji), menu ⚙️ na dole strony (dodaj link, dodaj sekcję, Zarządzanie),
  chowany pasek boczny, kafelki CPU i RAM w nagłówku (kolor wg progów) i dzwonek alertów.
  Awarie i przekroczone progi temperatur pokazuje pasek na górze strony (zamykany ✕).
- **Zaplecze** (chronione PIN-em, tryb dzień/noc wspólny ze Stroną Główną):
  - Ustawienia ogólne,
  - Centrum Alertów — stan kontenerów, temperatury, RAM, dyski, logi kontenerów;
    progi temperatur dla każdego czujnika i progi obciążenia CPU/RAM,
  - Statystyki Live — CPU, temperatury wszystkich czujników, RAM, dyski, sieć, procesy,
  - Strony i sekcje — dodawanie, nazwy, kolejność i usuwanie stron, sekcji i linków,
  - Aktualizacje kontenerów — porównuje wersje obrazów z najnowszymi stabilnymi
    i podmienia tag wersji w `compose.yaml` wybranego stosu,
  - Moduły (ustawienia Kiosku), edytor wyglądu Zaplecza (osobno dzień i noc).
- **Kiosk statusu serwera** — Status serwera, Live (zużycie per kontener),
  Status kontenerów, Radio.

## Wymagania

Serwer postawiony programem `if-server` (Debian 13). Instalator zakłada wszystko, czego strona
potrzebuje: Docker, Dockge, foldery `docker/app/` i `docker/app-data/`, zadanie z listą
aktualizacji Debiana.

## Bezpieczeństwo — przeczytaj przed instalacją

Dostęp do `docker.sock` i zapis do `docker/app/` daje kontenerowi praktycznie pełną
kontrolę nad serwerem. Dlatego:

- **PIN** ustawiasz przy instalacji (`if-server` o niego pyta), później w Zapleczu
  (Ustawienia ogólne). PIN ustawiony w Zapleczu ma pierwszeństwo przed tym z `compose.yaml`.
- **Nie wystawiaj strony do internetu.** Jest przeznaczona do sieci domowej
  (z zewnątrz — przez VPN).
- Po 5 błędnych próbach PIN-u z jednego adresu Zaplecze blokuje się na minutę,
  przy kolejnych seriach coraz dłużej (maks. 15 minut).
- Bez PIN-u działa tylko podgląd: kafelki, statystyki serwera, lista kontenerów
  i alerty (tego potrzebuje Kiosk). Edycja kafelków, logi kontenerów, sprawdzanie
  portów i zmiany ustawień wymagają PIN-u.

## Obraz kontenera

Obraz buduje GitHub Actions (`.github/workflows/strona-obraz.yml` w IF-home-server) przy
wydaniu `vX.Y.Z` (serwer i strona razem) albo `strona-vX.Y.Z` (sama poprawka strony):

```text
ghcr.io/if-faber/if-startpage:vX.Y.Z
```

## Instalacja i aktualizacja

**Instalacja:** stronę stawia `if-server` — w terminalu serwera `sudo if-server` → **Upgrade**.
Program pyta o PIN, zakłada stos `if-startpage` w Dockge z właściwymi ścieżkami i uruchamia
stronę pod adresem `http://adres-serwera/`. Instrukcja całości: README projektu IF-home-server.

**Aktualizacja strony:** Zaplecze → Aktualizacje → przy `if-startpage` „Aktualizuj compose”,
potem „Aktualizuj” w Dockge. Przy aktualizacji serwera (`sudo if-server` → aktualizuj → Upgrade)
strona starsza niż wersja wydana razem z serwerem jest aktualizowana sama; nowszej nie rusza.

Strona postawiona wcześniej ręcznie z niepodmienionym `{user}` w ścieżkach jest przy Upgrade
przenoszona na właściwe miejsce — po pytaniu na ekranie; stare dane zostają jako kopia.

### Ustawienia opcjonalne (zmienne środowiskowe)

- `DOCKER_VERSION_EXCLUDE` — kontenery pomijane przy sprawdzaniu wersji, po przecinku
  (np. obrazy budowane lokalnie).
- `DOCKER_STACK_OVERRIDES` — gdy nazwa kontenera różni się od nazwy stosu lub serwisu,
  w formacie JSON, np. `{"wordpress_db":{"stack":"wordpress","service":"db"}}`.

## Wygląd strony: dzień i noc

Wygląd startowy jest w `www/styles.css` (część obrazu, nie zmieniasz go).
Twoje zmiany z edytora wyglądu (menu ⚙️ w pasku bocznym → Wygląd) trafiają do dwóch zwykłych
plików CSS w katalogu konfiguracji:

- `config/custom-d.css` — tryb **dzień**,
- `config/custom-n.css` — tryb **noc**.

Na górze edytora wybierasz, który tryb edytujesz; „Zapisz wygląd” zapisuje plik tego trybu.
W plikach są tylko właściwości, dla których edytor ma kontrolki — każda z opisem po polsku.
Plik można poprawić ręcznie, ale kolejny zapis z edytora nadpisze go w całości.
„Wygląd startowy trybu” usuwa plik danego trybu. Tryb wybrany przełącznikiem zapamiętuje
przeglądarka.

Zaplecze używa tego samego trybu (przełącznik ☀️/🌙 jest też w menu Zaplecza). Jego wygląd
ustawia się w Zaplecze → Wygląd Zaplecza, osobno dla dnia i nocy — zapis trafia do
`config/admin-theme.json`. Kiosk ma jeden wygląd.

## Ikony aplikacji na kafelkach

W oknie linku w polu „Ikona” wpisujesz nazwę pliku, np. `immich.png`, `jellyfin.png`.

- Obraz zawiera ok. 160 popularnych ikon: aplikacje serwera domowego (Immich, Jellyfin,
  Home Assistant, Nextcloud, Dockge, Pi-hole, Vaultwarden i inne), popularne serwisy
  (Google, YouTube, Facebook, WhatsApp, Netflix, Amazon… — pełna lista w Zapleczu)
  i druk 3D (Printables, Prusa, OctoPrint, Klipper, Mainsail, Fluidd, OrcaSlicer, Cura, Spoolman).
  Logo Idea Forge: `idea-forge.webp`.
- Własne ikony przesyłasz w Zaplecze → Strony i sekcje → **Ikony aplikacji** („Prześlij ikony”)
  albo kopiujesz do folderu `~/docker/app-data/if-startpage/icons` na serwerze
  (PNG, SVG, WebP, JPG, ICO). Ikona o tej samej nazwie co wbudowana — zastępuje ją.
- **„Lista ikon”** w tym samym miejscu pokazuje wszystkie dostępne ikony z wyszukiwarką
  i przyciskiem „Kopiuj nazwę”.
- Wystarczy rozmiar ok. 128 × 128 px — na kafelku ikona ma 30 px.

W polu „Ikona” można też wpisać jedną literę albo adres obrazka z internetu.

### Ikony z Lucide — dla stron i linków (gdy nie ma logo aplikacji)

Do menu stron i do kafelków bez logo możesz wpisać ikonę z zestawu **Lucide** —
ponad 1800 prostych ikon (drukarka, serce, koszyk, kamera, router…). Ikony są w obrazie,
działają bez internetu.

1. Otwórz **https://lucide.dev/icons** i wpisz w wyszukiwarkę, czego szukasz — po angielsku,
   np. `printer` (drukarka), `heart` (serce), `cart` (koszyk), `camera`, `router`.
2. Kliknij ikonę — nazwa jest pod nią, np. `shopping-cart`. Skopiuj ją albo przepisz.
3. Wpisz tę nazwę:
   - **strona w menu:** Zaplecze → Strony i sekcje → pole „ikona” obok nazwy strony → **Zapisz**,
   - **link (kafelek):** w oknie linku w polu „Ikona”.

Nazwę wpisujesz **bez rozszerzenia** (`printer`, a nie `printer.png`). Z rozszerzeniem
(`immich.png`) to plik z folderu `icons` — logo aplikacji. Zła nazwa? Strona napisze,
że takiej ikony nie ma.

### Gdzie szukać ikon

| Źródło | Licencja | Co zawiera |
|---|---|---|
| [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) (Homarr) | Apache 2.0 | ponad 2500 kolorowych ikon aplikacji i serwisów — z tego pakietu pochodzą ikony wbudowane |
| [selfh.st/icons](https://selfh.st/icons-about/) | CC BY 4.0 (podaj autora) | ponad 7000 kolorowych ikon, PNG / WebP / SVG, wersje jasne i ciemne |
| [Simple Icons](https://simpleicons.org) | CC0 | ponad 3300 marek, jednokolorowe SVG (m.in. Allegro, Creality) |
| [SVG Logos](https://github.com/gilbarbara/logos) (Gil Barbara) | CC0 | ok. 1900 kolorowych logo, głównie technologie |
| Ikona samej strony | — | strony udostępniają ikonę dla telefonów (`apple-touch-icon`, zwykle 180 × 180 px) — dobre źródło dla polskich serwisów, których nie ma w pakietach |

Logotypy są znakami towarowymi swoich właścicieli — używaj ich tylko do oznaczenia kafelków
prowadzących do tych usług.

**Pamiętaj o podziękowaniu i licencji.** Każdy zestaw ikon ma swoją licencję i niektóre
wymagają podania autora (np. CC BY przy selfh.st/icons). Gdy dokładasz ikony z innego
źródła, zapisz w folderze `icons` zwykły plik tekstowy, np. `ZRODLA.txt`, a w nim
dla każdego źródła:

```text
Źródło:   selfh.st/icons — https://selfh.st/icons
Autor:    selfh.st
Licencja: CC BY 4.0 (wymaga podania autora)
Ikony:    np. jellyseerr.png, immich.png
```

Licencje ikon dołączonych do IF-startpage (dashboard-icons, Lucide) są w
[THIRD-PARTY.md](THIRD-PARTY.md).

## Aktualizacje aplikacji (Zaplecze → Aktualizacje)

Tabela pokazuje dla każdej aplikacji (kontenera) zainstalowaną i najnowszą wersję.

- **Sprawdzanie raz dziennie** — IF-startpage sam sprawdza nowe wersje raz na dobę i zapamiętuje
  wynik. Przycisk **„Sprawdź teraz”** sprawdza od razu.
- **„Poprawka”** — nowa wersja w tej samej linii (np. 11.8.9 → 11.8.10). Zwykle bezpieczna.
- **„Większa zmiana” ⚠** — nowa wersja w innej linii (np. 11.8 → 13.0). Przeczytaj **„Co nowego”**,
  a przy aplikacjach z danymi (bazy danych!) zrób najpierw kopię danych.
- **„Obraz lokalny (tester)”** — obraz zbudowany na Twoim serwerze; nie ma czego sprawdzać.
- Gdy są nowe wersje, w dzwonku pojawia się informacja **„Dostępne aktualizacje: N”**.

Jak zaktualizować aplikację — dwa kroki, żeby widzieć, co się dzieje:

1. **„Aktualizuj compose”** — zapisuje w `compose.yaml` aplikacji tylko nowy numer wersji.
   Przed zmianą zapisuje kopię w folderze `backup` aplikacji
   (`~/docker/app/<aplikacja>/backup/`, ostatnie 5 kopii).
2. **„Restart / Aktualizuj”** — otwiera aplikację w Dockge. Kliknij tam **„Aktualizuj”**
   i patrz, jak pobiera się nowa wersja i aplikacja startuje.

Coś poszło nie tak? **„Cofnij”** przywraca `compose.yaml` z ostatniej kopii — potem znowu
„Aktualizuj” w Dockge.

**WordPress:** sam WordPress, wtyczki i motywy aktualizujesz w panelu WordPressa
(Kokpit → Aktualizacje). Nowy obraz `wordpress` zmienia tylko PHP i serwer Apache.

### Aktualizacje Debiana (pakiety systemowe)

Kontener IF-startpage nie widzi pakietów serwera. Dlatego serwer raz dziennie zapisuje
listę oczekujących aktualizacji do pliku, a IF-startpage ją pokazuje (Zaplecze → Aktualizacje
i dzwonek: „Aktualizacje systemu: N”). **Instalujesz je w Cockpit** (Aktualizacje oprogramowania).
Po każdej instalacji lub aktualizacji pakietów lista odświeża się sama w ciągu minuty (plik
`99if-system-updates` w ustawieniach apt) — nie trzeba czekać do następnego dnia.

Zadanie ustawia `if-server` (składnik „Narzędzia dla IF-startpage”). Gdy w Zapleczu widzisz
„Serwer nie zapisuje jeszcze listy aktualizacji” — w terminalu serwera `sudo if-server` → Upgrade.
Pliki zadania: `strona/extras/system-updates/`.

### Program serwera (IF-home-server)

Między pakietami systemowymi a kontenerami jest linijka **IF-home-server**: zainstalowana
i najnowsza wersja programu serwera. Nowszą instalujesz w terminalu: `sudo if-server` → aktualizuj.

## Znane ograniczenia

- **Aktualizacje pakietów systemowych (apt)** nie są sprawdzane z wnętrza kontenera —
  kontener nie widzi pakietów serwera. Zakładka odsyła do Cockpit (port 9090).
- **Dyski** w Diagnostyce pokazują to, co widzi kontener — zwykle dysk systemowy.
- **Procesy** w Top / Statystykach Live to procesy kontenera, nie całego serwera
  (kontener ma własną przestrzeń procesów).

## Dokumentacja i pytania

Pełna dokumentacja krok po kroku, ze zdjęciami, jest w przygotowaniu.
Coś jest niejasne albo nie działa? Zgłoś to w [Issues](https://github.com/if-faber/IF-home-server/issues).
Odpowiadam zwykle raz w tygodniu.

## Podziękowania

Ikony usług pochodzą z projektu
[dashboard-icons](https://github.com/homarr-labs/dashboard-icons).
Szczegóły i licencje materiałów osób trzecich: [THIRD-PARTY.md](THIRD-PARTY.md).

## Licencja

MIT — zobacz [LICENSE](LICENSE).

## Historia zmian

[version-changelog.md](version-changelog.md)
