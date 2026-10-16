# Historia zmian — IF-startpage

Nowe wpisy dopisujemy na górze. Od v0.3.0 strona jest częścią IF-home-server (folder `strona/`);
druga cyfra wersji jest wspólna z serwerem, trzecia — poprawki samej strony.

---

## v0.3.0 — 2026-10-15

Pierwsza połączona wersja: serwer (if-server), Dockge i strona startowa jako jedna całość.

- **Aktualizacje: linijka „IF-home-server (program serwera)”** — zainstalowana i najnowsza wersja programu serwera, z podpowiedzią, jak zaktualizować. Wersję zainstalowaną podaje serwer (zadanie `if-system-updates`), najnowszą strona sprawdza na GitHubie.
- Stronę instaluje i aktualizuje if-server — bez ręcznego wklejania compose do Dockge.
- „Co nowego” strony prowadzi do tej historii zmian w IF-home-server.
- Komunikat o braku listy Debiana podpowiada `sudo if-server` → Upgrade zamiast instrukcji z README.

---

## v0.1.7.2 — 2026-10-15

- **Aktualizacje: koniec z „nieznaną” wersją kontenerów po chwilowym braku internetu.** Sprawdzenia wszystkich kontenerów zapisywały wyniki jednocześnie i nadpisywały się nawzajem — w pamięci zostawały stare błędy. Teraz każde dopisuje swój wynik, a nieudane sprawdzenie (np. zaraz po restarcie serwera) jest ponawiane po 10 minutach, nie po dniu, bez gubienia ostatniej znanej listy wersji.

---

## v0.1.7.1 — 2026-10-15

- **Ikona sekcji wyświetla się na stronie głównej** (w v0.1.7 była widoczna tylko w Zapleczu).
- **Lista aktualizacji Debiana odświeża się od razu po każdej instalacji pakietów** (Cockpit, apt) — nowy plik `extras/system-updates/99if-system-updates` dla apt; instrukcja w README. Na serwerze z [IF-home-server](https://github.com/if-faber/IF-home-server) ustawia go składnik „Narzędzia dla IF-startpage”.
- Opisy w Aktualizacjach mówią, kiedy lista się odświeża.

---

## v0.1.7 — 2026-10-15

Koniec prac nad wyglądem (wersje 0.1.6.x).

- **Napisy na tle strony mają własne kolory.** W edytorze wyglądu część „Nagłówek i napisy na tle”: doszedł **kolor tytułu strony** oraz **kolor, wielkość i cień tytułów sekcji**. „Kolor nagłówków (Akcent 2)” działa już tylko na kafelkach i w okienkach — jasne tło i jasne kafelki nie gryzą się ze sobą. Bez nowych ustawień wygląd się nie zmienia.
- **Ikony sekcji (Lucide).** W Zapleczu → Strony i sekcje: „Wybierz ikonę” → lista ikon Lucide → **„Zastosuj”**. Ikona stoi przed nazwą sekcji na stronie. Szybkie „Dodaj sekcję” na stronie głównej bez zmian.
- **Lista ikon z ikonami Lucide.** Pod obrazkami aplikacji wszystkie ikony Lucide z serwera (ok. 1900), jedna wyszukiwarka dla obu, odnośnik „Pełna lista ikonek Lucide”. Przycisk „Lista ikon” także w kafelku „Strony, sekcje i linki”.
- **Strona Narzędzia:** obok testera portów kafelek **„Narzędzia Pomocnicze”** — miejsce na kolejne narzędzia (na razie pusty).
- **Centrum Alertów:** stan ogólny **Stabilny / Wymaga uwagi / Awaria** — informacja o aktualizacjach nie włącza już „Awarii”; w kafelku „Aktywne alerty” także liczba informacji. Nazwy kontenerów oraz „Cockpit Linux” i „Dockge Stacks” widoczne w trybie dziennym (były białe na białym).
- **Nasze okienka zamiast okienek przeglądarki** — pytania („Usunąć…?”) i komunikaty wyglądają jak reszta okien (ustawienia „Okna modalne”), przycisk mówi, co robi („Usuń”, „Przywróć”), a na starcie zaznaczone jest „Anuluj”.
- **Budowanie obrazu na GitHubie:** Ubuntu 24.04 zamiast „latest” i akcje na Node.js 24.

---

## v0.1.6.11 — 2026-10-13

Aktualizacje aplikacji i Debiana w Zapleczu.

- **Aktualizacje aplikacji:** sprawdzanie nowych wersji raz dziennie (wynik zapamiętany) i przycisk **„Sprawdź teraz”**.
- **„Poprawka” albo „Większa zmiana” ⚠** — nowa wersja w tej samej linii (np. 11.8.9 → 11.8.10) albo w innej (np. 11.8 → 13.0); przy większej zmianie ostrzeżenie i potwierdzenie „zrób kopię danych”.
- **„Co nowego”** przy wersji — lista zmian (aplikacje Idea Forge) albo strona obrazu; notka przy WordPressie.
- **Kopie `compose.yaml`** przed zmianą wersji w `docker/app/<aplikacja>/backup/` (ostatnie 5) i przycisk **„Cofnij”**.
- **Obraz lokalny (tester)** — obraz zbudowany na serwerze oznaczony, bez szukania wersji i błędów w logach.
- **Dzwonek:** „Dostępne aktualizacje: N” — informacja, nie alarm.
- **Aktualizacje Debiana:** lista oczekujących pakietów (z oznaczeniem aktualizacji bezpieczeństwa) od serwera — zadanie `if-system-updates` (ustawia je [IF-home-server](https://github.com/if-faber/IF-home-server) albo polecenia z README); w dzwonku „Aktualizacje systemu: N”. Instalacja — w Cockpit.
- **Wersja IF-startpage widoczna w Zapleczu.**
- **Grzeczne wyłączanie** — aktualizacja w Dockge nie czeka już 10 s i nie kończy się „exited with code 137”.

---

## v0.1.6.10 — 2026-10-13

- **Menu Zaplecza w logicznym porządku**, w trzech grupach z podpisami: **Treść strony** (Strony i sekcje), **Serwer** (Centrum Alertów, Statystyki Live, Aktualizacje), **Ustawienia** (Moduły, Wygląd Zaplecza, Ustawienia ogólne) — od najczęściej używanych. Zaplecze otwiera się na „Stronach i sekcjach”.
- **Stopka menu Zaplecza jak na Stronie Głównej:** trzy ikonki w rzędzie — tryb dzień/noc, powrót do serwisu, wylogowanie (pełne nazwy w podpowiedziach). Menu mieści się bez paska przewijania.

---

## v0.1.6.9 — 2026-10-13

Nowe menu, ikony Lucide dla stron i linków, porządki w edytorach wyglądu.

- **Menu stron — prosta lista:** ikona i nazwa w jednej linii, aktywna pozycja w zaokrąglonym, półprzezroczystym tle (zamiast przycisków „lizak”). Nic się nie rozjeżdża przy żadnej szerokości ani wielkości ikon.
- **Ikony stron z Lucide:** Zaplecze → Strony i sekcje — pole „ikona” przy każdej stronie i przy dodawaniu, z podglądem na żywo. Nazwę wyszukujesz na lucide.dev/icons (np. `printer`, `heart`). Pełny zestaw Lucide (`lucide-static` 1.56.0, 1879 ikon) jest w obrazie — działa bez internetu.
- **Ikony linków z Lucide:** w polu „Ikona” linku można wpisać nazwę z Lucide (bez rozszerzenia); logo aplikacji (`immich.png`), litera i adres obrazka działają jak dotąd. Zła nazwa — serwer nie zapisze i powie, gdzie szukać.
- **Dymki ⓘ** przy kontrolkach edytorów wyglądu — co dana kontrolka zmienia (działa myszą i dotykiem).
- **Wygląd (na żywo):**
  - „Kolor nagłówków (Akcent 2)” — wszystkie nagłówki (h2, tytuły okien, kart Status i sekcji z kafelkami) jedną kontrolką; drobiazgi, które wcześniej brały Akcent 2, biorą Akcent albo stały kolor (wykresy Top).
  - „Kolor tekstu w polach” — tekst w polach formularzy i podpowiedzi.
  - Pasek boczny: „Glass” i „Blur paska z nazwą” (najechanie i aktywna pozycja dziedziczą szkło), „Menu: kolor napisów”, „Menu: ikona po najechaniu”, „Aktywna pozycja: tło / ikona”; „Kolor / Wielkość ikon menu” steruje ikonami menu, ☰ i stopki.
  - Przycisk ☰ wygląda jak ⚙️ w stopce menu; ikony stopki (☀️/🌙, ⚙️) w kolorach menu.
- **Wygląd Zaplecza:** „Kolor nagłówków (Akcent pomocniczy)” i „Kolor tekstu w polach”.
- **Zaplecze → Strony i sekcje (tryb dzień):** pola i bloki w kolorach motywu (wcześniej ciemne plamy), plakietka „Strona główna ⓘ”, „+ Dodaj sekcję”.
- **README:** instrukcja „Ikony z Lucide — dla stron i linków” oraz przypomnienie o podziękowaniach i licencjach przy dokładaniu cudzych ikon (wzór pliku `ZRODLA.txt`).
- Naprawione: wartość suwaka nachodziła na ⓘ; dymki ściskane do wąskiego paska w Zapleczu; poziomy pasek przewijania w menu.
- Porządki: usunięte nieużywane style po starym oknie „Strony i sekcje” i przycisku „Dodaj stronę” w menu.

---

## v0.1.6.8 — 2026-10-12

- **Po zmianie PIN-u wylogowanie.** Zmiana PIN-u w Zapleczu → Ustawienia ogólne wylogowuje z Zaplecza; na Stronie Głównej przeglądarka zapomina zapisany PIN i przy następnej edycji pyta o nowy. Wcześniej przeglądarka wysyłała dalej stary PIN — kolejne zapisy (np. wygląd dnia) były odrzucane, a każda próba liczyła się do blokady PIN-u.

---

## v0.1.6.7 — 2026-10-12

Przesyłanie ikon, lista ikon i więcej ikon wbudowanych.

- **Zaplecze → Strony i sekcje → Ikony aplikacji:** „Prześlij ikony” — wybór plików z komputera (PNG, SVG, WebP, JPG, ICO, do 2 MB, kilka naraz), zapis do folderu `icons`. Nazwa pliku porządkowana (małe litery, „-” zamiast spacji, polskie litery bez ogonków). Gdy ikona już jest — pytanie, czy zastąpić. Plik dostaje prawa `644` i właściciela folderu `icons` (nie root), więc wyświetla się na stronie i da się go edytować na serwerze. Wymaga PIN-u.
- **„Lista ikon”** — okno z tabelą Ikona | Nazwa | „Kopiuj nazwę”, wyszukiwarka i podsumowanie. Plakietka „Twoja” — ikona dodana albo podmieniona; „Wbudowana” — ikona z obrazu (także jej identyczna kopia w folderze `icons`). Kopiowanie działa też na zwykłym `http://` w sieci domowej.
- **Ikony wbudowane:** ok. 160 — doszły popularne serwisy (Facebook, WhatsApp, Telegram, Discord, Amazon, PayPal, usługi Google, Microsoft 365…), druk 3D (Printables, Prusa, OctoPrint, Klipper, Mainsail, Fluidd, Obico, OrcaSlicer, Cura, Spoolman) i logo Idea Forge (`idea-forge.webp`).
- **README:** sekcja „Gdzie szukać ikon” (dashboard-icons, selfh.st/icons, Simple Icons, SVG Logos, ikona samej strony) z licencjami.
- **Okna (modale) Zaplecza** wyglądają jak na Stronie Głównej — biorą ustawienia okien z pliku trybu dzień / noc Strony Głównej.
- SVG z folderu `icons` wysyłany z blokadą skryptów.
- Naprawione: na dole Strony Głównej tło strony zasłaniało pas tapety (pozostałość po pasku z trzema przyciskami).

---

## v0.1.6.6 — 2026-10-12

Ikony aplikacji w osobnym folderze.

- **Wolumen `icons`** (`/home/{user}/docker/app-data/if-startpage/icons` → `/app/icons`) na własne ikony aplikacji do kafelków. W oknie linku (Strona Główna i Zaplecze) w polu „Ikona” wpisujesz nazwę pliku, np. `immich.png`. Ikony w tym folderze są w backupie i przeżywają aktualizację obrazu.
- **Obraz zawiera ok. 100 najpopularniejszych ikon** zamiast całego pakietu (2546) — obraz mniejszy o ok. 85 MB. Ikona z folderu `icons` o tej samej nazwie zastępuje wbudowaną.
- Pełny pakiet ikon: [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) — pojedyncze pliki można skopiować do folderu `icons`.

---

## v0.1.6.5 — 2026-10-12

Porządki w menu, progi alarmów, ikony Lucide i tryb dzień / noc w Zapleczu.

- **Menu ⚙️ na dole strony** zamiast trzech przycisków: „Dodaj link”, „Dodaj sekcję” (małe okno z jednym polem, sekcja trafia na bieżącą stronę) i „Zarządzanie” (Zaplecze → Strony i sekcje, od razu na bieżącej stronie).
- **Okno „Strony i sekcje” usunięte** ze Strony Głównej, razem z przyciskiem „Dodaj stronę” w menu i systemowym okienkiem `prompt()`. Strony dodaje się, przemianowuje, sortuje i usuwa w Zapleczu → **Strony i sekcje** (dawniej „Homepage”).
- **Pasek awarii** (`incident-bar`) — jedna klasa dla paska na Stronie Głównej, okienka dzwonka, widoku Alerty i Centrum alertów; pełne kolory niezależne od motywu (czerwony — alarm, pomarańczowy — uwaga). Przycisk ✕ chowa pasek; wraca przy nowym zgłoszeniu albo zmianie z „uwagi” na „alarm”. Alert zostaje w dzwonku.
- **Progi temperatur** (Zaplecze → Centrum alertów): tabela wszystkich czujników — obecna temperatura, próg „Uwaga” i „Alarm”, „Resetuj do domyślnych” i „Zapisz”. Domyślne progi wg rodzaju czujnika; własne w `config/temperature-thresholds.json`. Przekroczenie progu → alarm w pasku, dzwonku i Centrum alertów (wcześniej stały próg 78/85 °C tylko dla procesora).
- **Progi obciążenia CPU i RAM** (domyślnie 70/90 % i 80/95 %, `config/load-thresholds.json`) — kolor kafelków CPU i RAM w nagłówku, bez paska alarmowego. Kafelek TEMP usunięty z nagłówka.
- **Temperatury:** kafelek procesora bierze ogólną temperaturę CPU (Intel „Package id”, AMD „Tctl”), a nie pierwszy znaleziony czujnik (płyta główna). Statystyki Live mają kafelek „Temperatury” ze wszystkimi czujnikami; kolory wg progów.
- **Top:** naprawiona tabela procesów (kolumny czytane wg nagłówka `top`, nie wg stałych pozycji); kolory ramek zależne od motywu — czytelne w trybie dziennym.
- **Ikony Lucide zamiast emoji** w całym interfejsie Strony Głównej i Zaplecza (menu, tytuły, przyciski, nagłówki kafelków). Menu Zaplecza: „Helper & System” → **Ustawienia ogólne**, „Homepage” → **Strony i sekcje**; nazwy wyrównane do lewej.
- **Tryb dzień / noc w Zapleczu** — przełącznik w menu Zaplecza, tryb wspólny ze Stroną Główną. Wygląd Zaplecza zapisywany osobno dla dnia i nocy (`config/admin-theme.json`: `{ themes: { d, n } }`; dotychczasowy wygląd staje się nocnym). Jasny wygląd startowy dnia w `admin.css`; edytor „Wygląd Zaplecza” ma na górze wybór trybu.
- Naprawione: przyciski „Pauza” / „Odśwież” w panelu Top na Stronie Głównej nie miały stylu.

---

## v0.1.6.4 — 2026-10-12

- **Zaplecze → Homepage zna strony:** na górze wybór strony; sekcje i linki tej strony, ich kolejność strzałkami, dodawanie sekcji na wybraną stronę.
- **„Przenieś na stronę…”** przy każdej sekcji — przenosi sekcję z linkami na inną stronę (na jej koniec).

---

## v0.1.6.3 — 2026-10-12

Strony w menu i ikony zamiast emoji.

- **Strony:** w menu na górze Home i dodane strony. „+ Dodaj stronę” pyta tylko o nazwę, strona od razu pojawia się w menu. Sekcje są nagłówkami grup kafelków na stronie.
- **Home** można przemianować; nie można go usunąć. Usunięcie innej strony nie kasuje kafelków — jej sekcje przechodzą na Home. Obecne sekcje trafiają automatycznie na Home.
- **Stałe strony serwera** pod kreską: Status serwera, Top (procesy), Narzędzia (test portów), Alerty — wcześniej wszystko było na jednym widoku.
- **Przyciski menu w stylu „lizak”** (jak w Kiosku): okrągła główka z ikoną i patyczek z nazwą.
- **Ikony Lucide** (licencja ISC) zamiast emoji w menu, przy dzwonku i ⚙️.
- Okno „Strona i sekcje” (przycisk na dole i w menu ⚙️): nazwa strony, kolejność stron, usuwanie, sekcje tej strony.
- Edycja i usuwanie kafelka bez odblokowania najpierw pyta o PIN.
- Sekcje dodane w Zapleczu (zakładka Homepage) trafiają na Home.

---

## v0.1.6.2 — 2026-10-12

Nowa ikona i uporządkowane menu Strony Głównej.

- **Ikona IF-startpage** (dom z kafelkami w kolorach Idea Forge): logo w nagłówku, favicon, ikona na telefonie. Źródło: `www/images/if-startpage.svg`.
- **Menu na dole paska bocznego:** zamiast pięciu ikon bez podpisów — przełącznik ☀️/🌙 i jeden przycisk ⚙️ z rozwijanym menu z podpisami: Wygląd (na żywo), Sekcje i kafelki, Zaplecze, Zablokuj/Odblokuj edycję.
- **Dzwonek alertów** przeniesiony do nagłówka, obok wyszukiwarki.
- **Stopka** „created by Idea Forge” pod menu.
- **Przyciski „+ Dodaj sekcję” i „+ Dodaj link”** zawsze na samym dole widoku (przyklejone do dołu przy przewijaniu). Bez odblokowanej edycji najpierw pytają o PIN.
- Podpowiedź na pustej stronie wskazuje przycisk „+ Dodaj sekcję”.
- Naprawione: manifest aplikacji odsyłał do nieistniejącego pliku `logo-512.png`.

---

## v0.1.6.1 — 2026-10-12

Tryb dzień / noc na Stronie Głównej.

- **Przełącznik ☀️/🌙** na dole paska bocznego (ikona z projektu theme-toggles, MIT). Wybór zapamiętuje przeglądarka; domyślnie noc.
- **Wygląd w plikach CSS:** zmiany z edytora 🎨 zapisują się do `config/custom-d.css` (dzień) albo `config/custom-n.css` (noc). Wygląd startowy zostaje w `styles.css`.
- **Wybór trybu na górze edytora** — edytor wie, który plik zmienia; „Zapisz wygląd” zapisuje plik wybranego trybu, „Wygląd startowy trybu” go usuwa.
- **Wygląd startowy dnia i nocy** w `custom-defaults/custom-d.css` i `custom-n.css` — dopracowane kolory, niższe kafelki, spokojniejsze ramki.
- Nowe kontrolki: kolor tekstu, kolor tekstu pomocniczego, tekst na przyciskach w kolorze akcentu.
- **Naprawione:** „Anuluj” w edytorze strony zostawiał niezapisane zmiany na ekranie do przeładowania.
- Zgodność: dotychczasowy zapis wyglądu (`theme.json`) działa w trybie noc do pierwszego zapisu nocy, potem zostaje jako `theme.json.old`.

---

## v0.1.6 — 2026-10-12

Wygląd startowy i naprawiony edytor wyglądu Zaplecza.

- **Naprawione:** dotknięcie dowolnej kontrolki w edytorze „Wygląd Zaplecza” zmieniało wygląd całego Zaplecza (np. panele robiły się białe). Formularz czyta teraz aktualne wartości z CSS, a zapisuje tylko to, co zmieniono.
- **Naprawione:** ustawienia przycisków (kolory, najechanie, ramka, poświata) działały tylko na podglądzie — teraz zmieniają prawdziwe przyciski Zaplecza.
- **Naprawione:** „Przywróć domyślne” nie cofało zmian do czasu przeładowania strony; kolor ramki przycisków był zawsze czarny; nie dało się ustawić wartości 0 (np. bez zaokrąglenia, bez poświaty).
- **Naprawione:** przy każdym zapisie wygląd z wgraną tapetą zapisywał cały obraz w pliku ustawień.
- **Naprawione:** wgrane logo i tapety znikały po aktualizacji obrazu kontenera — teraz trafiają do wolumenu z konfiguracją (`config/uploads`).
- Nowy przycisk **„Cofnij zmiany”** w edytorze wyglądu Zaplecza.
- **Wygląd startowy Zaplecza:** ciemne panele, spokojne przyciski menu (aktywny bez jaskrawego wypełnienia), wyraźny przycisk główny, czytelny przycisk ostrzegawczy, bez pustego pasa pod tytułem.
- **Wygląd startowy strony:** lżejszy pasek boczny, wyraźny przycisk główny, podpowiedź na pustej stronie, jak dodać pierwsze kafelki.
- Zakładka Helper na świeżej instalacji podpowiada nazwę serwera, adres API i host zamiast pustych pól.
- Serwer sprawdza ustawienia wyglądu Zaplecza przed zapisem (tylko znane pola, bez znaków spoza wartości CSS).

---

## v0.1.5 — 2026-10-12

Porządki i bezpieczeństwo po audycie.

- **PIN wymagany** do edycji kafelków i sekcji, logów kontenerów i sprawdzania portów (wcześniej działały bez PIN-u).
- **Blokada zgadywania PIN-u:** po 5 błędnych próbach blokada na minutę, kolejne serie coraz dłużej (maks. 15 min). Porównanie PIN-u odporne na pomiar czasu.
- **Bez otwartego CORS:** obce strony otwarte w przeglądarce nie mogą wywoływać API serwera.
- Domyślny PIN ujednolicony z przykładem w `compose.yaml` (`1234`); nowy PIN musi mieć min. 4 znaki.
- Aktualizacje: walidacja nazwy stosu przed zapisem `compose.yaml`; wykluczenia i wyjątki nazw konfigurowane zmiennymi `DOCKER_VERSION_EXCLUDE` i `DOCKER_STACK_OVERRIDES` zamiast wpisanych na sztywno.
- Zakładka pakietów apt uczciwie informuje, że kontener nie widzi pakietów serwera, i odsyła do Cockpit.
- Usunięte martwe pliki (`mods/alerts/alerts.js`, `alerts.css`) i odwołania do nieistniejącego `storm-alert` w Kiosku.
- Nazwy „MyHome” i „Homelab NAS” w interfejsie zastąpione nazwą IF-startpage.
- `compose.yaml` na pełnych ścieżkach z `{user}`, zgodnie z README; przypięta wersja obrazu `docker:27-cli`.
- Dodany `THIRD-PARTY.md` (ikony z projektu dashboard-icons) i sekcja Podziękowania w README.

---

## v0.1.4 — 2026-09-18

Pierwsza publiczna wersja IF-startpage: samodzielna strona startowa serwera domowego, działająca w kontenerze Docker.

- **Strona Główna:** kafelki linków w sekcjach, motyw dzień/noc, chowany pasek boczny, widżet CPU/RAM/temperatury w nagłówku.
- **Zaplecze (chronione PIN-em):** Centrum Alertów, Diagnostyka Serwera (Top), Statystyki Live, Aktualizacje kontenerów, Helper & System, edytor wyglądu.
- **Kiosk statusu serwera:** Status serwera, Live (zużycie per kontener), Status kontenerów, Radio.
- **Obraz kontenera** budowany automatycznie przez GitHub Actions i publikowany w `ghcr.io/if-faber/if-startpage`.
- Konfiguracja użytkownika (kafelki, wygląd, PIN) trzymana wyłącznie w zamontowanym wolumenie, nigdy w repo ani w obrazie.
