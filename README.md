# IF-home-server

Instalator systemowy domowego serwera — uruchamiany raz na czystym
Debianie (instalacja netinst), instaluje i konfiguruje wszystko, co
potrzebne do działania serwera (Cockpit, Samba, serwer druku, Dockge).
Część pakietu **IdeaForge** dla serwerów domowych — zobacz też
[`IF-startpage`](https://github.com/if-faber/IF-startpage), jego stronę
startową.

## Filozofia

Backup = obraz czystego systemu (bez danych) + ten skrypt. Przywrócenie
serwera po awarii to: nagranie obrazu Debiana, uruchomienie skryptu,
odtworzenie danych z osobnego backupu danych. Cały proces ma trwać kilka
minut, a nie godziny ręcznej konfiguracji.

## Wymagania

- Czysty Debian (netinst) z kontem użytkownika i włączonym „SSH server”
  (wybór oprogramowania podczas instalacji Debiana). `sudo` i `curl`
  doinstalujesz w kroku 3 poniżej.
- Kabel sieciowy podczas instalacji Debiana (netinst pobiera pakiety z internetu).
- Dostęp do internetu (pobiera pakiety z apt, repozytoria Dockera i
  wtyczek Cockpit z GitHuba).

## Instalacja krok po kroku

W poleceniach poniżej zamiast konkretnej nazwy jest `{user}`:

> **{user} — twoja nazwa użytkownika** (ta, którą podałeś przy instalacji
> Debiana i którą logujesz się do serwera, np. przez PuTTY).

Świeży Debian (netinst) **nie ma ani `curl`, ani `sudo`**, a jeśli przy
instalacji Debiana ustawiłeś hasło dla konta **root**, Twoje konto nie ma
jeszcze uprawnień administratora. To normalne działanie Debiana. Dlatego
najpierw krótkie przygotowanie — polecenia wykonuj dokładnie w tej kolejności.

**1. Połącz się z serwerem** (np. przez PuTTY) i zaloguj się jako {user}.

**2. Przełącz się na konto root** — zapyta o hasło **roota** (to z
instalacji Debiana):

```sh
su -
```

**3. Zainstaluj sudo i curl, dodaj siebie do administratorów** (zamiast
`{user}` wpisz swoją nazwę):

```sh
apt-get update
apt-get install -y sudo curl
usermod -aG sudo {user}
exit
```

> ### ⛔ STOP — zamknij całe okno PuTTY i połącz się od nowa
>
> Samo `exit` nie wystarczy. Bez ponownego połączenia system nie widzi
> nowych uprawnień i następny krok skończy się błędem
> „{user} nie jest w pliku sudoers”.

**4. Po ponownym zalogowaniu pobierz i uruchom instalator** — `sudo` zapyta
o hasło Twojego konta ({user}), nie roota:

```sh
curl -fsSL https://raw.githubusercontent.com/if-faber/IF-home-server/main/install-myhome.sh -o install-myhome.sh
sudo bash install-myhome.sh
```

**5. Przejdź przez panel instalatora**: rola drukowania, sudo (z hasłem —
zalecane — albo bez), hasło do udostępniania plików (Samba), podsumowanie.
Na końcu instalator pokaże adres serwera i zaproponuje restart.

## Pierwsze logowanie do paneli

- **Cockpit** — `https://{adres-serwera}:9090`. Logujesz się kontem {user}
  i hasłem z instalacji Debiana. Ostrzeżenie przeglądarki o certyfikacie jest
  normalne („Zaawansowane → Przejdź”). Na górze widać „Dostęp
  administracyjny” — to tryb ograniczony przy sudo z hasłem; pełne
  uprawnienia włączasz kliknięciem i hasłem {user}.
- **Dockge** — `http://{adres-serwera}:5001`. Dockge **nie zna** Twojego
  konta z Debiana i nie pobierze go sam: przy pierwszym wejściu ręcznie
  zakładasz osobne konto administratora Dockge (nazwa i hasło tylko do
  Dockge). Konto zakłada ten, kto wejdzie pierwszy — zrób to od razu po
  instalacji.
- **Udostępnione foldery (Samba)** — w Windows wpisz w pasku Eksploratora
  `\\{adres-serwera}` i zaloguj się jako {user} hasłem ustawionym w panelu
  instalatora.

> **{adres-serwera}** — adres IP serwera w Twojej sieci (pokazuje go
> instalator na końcu; najlepiej zarezerwować go w routerze).

Instalację z lokalnej kopii pliku też można uruchomić: `sudo ./install-myhome.sh`
(albo `./install-myhome.sh` po `su -`).

> Wewnętrzny adres LAN (Gitea) dla prac rozwojowych w sieci domowej nie
> jest tu publikowany — kod na Gitea i GitHubie jest identyczny, więc do
> instalacji zawsze wystarczy publiczny adres z GitHuba powyżej.

### Zmienne środowiskowe (konfiguracja)

| Zmienna             | Domyślnie          | Znaczenie |
|---------------------|--------------------|-----------|
| `TARGET_USER`        | autodetekcja       | Użytkownik, dla którego konfigurowane są sudo/docker/samba/struktura katalogów. Autodetekcja: `$SUDO_USER` → `logname` → jedyne konto UID≥1000 w `/etc/passwd`. |
| `PRINT_SERVER_ROLE`  | `client`           | `client` instaluje tylko klienta CUPS (zakłada, że pełny serwer druku działa gdzie indziej w sieci). `server` instaluje pełny serwer CUPS — wybierz to, jeśli to Twój pierwszy serwer domowy i chcesz też hostować drukarki. |
| `SUDO_MODE`          | `password`         | `password` — sudo pyta o hasło użytkownika (zalecane). `nopasswd` — sudo bez hasła (wygodniej, ale przejęcie konta = przejęcie serwera). W panelu graficznym wybierasz to przyciskiem. |

Przykład: `TARGET_USER={user} PRINT_SERVER_ROLE=server sudo -E ./install-myhome.sh`

## Co instaluje skrypt (kolejność)

0. **sudo** dla wykrytego użytkownika — do wyboru w panelu: z hasłem (domyślnie i zalecane: kto przejmie konto, nie dostaje od razu roota) albo bez hasła. Do tego curl, git, lsb-release.
1. **Quiet boot** — wyciszenie GRUB-a i logów jądra na konsoli.
2. **Pakiety systemowe** — SSH, avahi (mDNS/.local), smartmontools/lm-sensors/sysstat/htop (diagnostyka), CUPS (klient lub serwer, patrz `PRINT_SERVER_ROLE`), sane-utils, cifs-utils/nfs-common (NFS/CIFS), nodejs, python3-pip, python3-venv.
3. **Docker + Docker Compose** (oficjalne repozytorium Dockera). Użytkownik docelowy dopisywany do grup `docker` (i `lpadmin`, jeśli istnieje — czyli tylko przy pełnym serwerze CUPS).
4. **Struktura katalogów myhome** w katalogu domowym użytkownika (patrz niżej).
5. **Dockge** — menedżer stosów Docker Compose, instalowany jako pierwszy stos i od razu uruchamiany (port 5001).
6. **Samba** — instalacja, włączenie usług, ustawienie hasła sieciowego dla użytkownika (jedyny krok wymagający ręcznej interakcji).
7. **Cockpit** + wtyczki (45Drives: Navigator, File Sharing, Identities; z GitHuba: Explorer, Docker Manager, CTOP). Wtyczki Sensors i Compose są świadomie pominięte: Sensors pokazuje temperatury tylko w Fahrenheitach (CTOP pokazuje je w Celsjuszach), a Compose dubluje Dockge.
8. **Cockpit PCP** — statystyki wydajności.
9. **Wyłączenie zbędnych usług** (colord, nfs-blkmap).

Cały surowy output komend trafia do `/var/log/myhome-install.log` — na
ekranie widać tylko czyste, kolorowe statusy (`[n/10] ... OK`).

### Źródła spoza Debiana — na co uważać

Dwa źródła wtyczek Cockpit są szczególne: instalują paczki spoza oficjalnych repozytoriów Debiana z uprawnieniami roota.

- **45Drives** (Navigator, File Sharing, Identities) — repozytorium dodawane skryptem `curl -sSL https://repo.45drives.com/setup | bash`. Skrypt z internetu dostaje uprawnienia roota. Ufamy mu, bo 45Drives to firma, która utrzymuje te wtyczki publicznie od lat.
- **Docker Manager** (chrisjbawden/cockpit-dockermanager) — repozytorium APT oznaczone `[trusted=yes]`, czyli bez sprawdzania podpisu paczek.

Jeśli któreś z tych źródeł zostałoby przejęte, przy instalacji lub aktualizacji mogłoby trafić na serwer coś innego niż wtyczka. Dlatego: przed instalacją sprawdź, czy projekty są nadal utrzymywane, a jeśli którejś wtyczki nie potrzebujesz, możesz ją pominąć.

## Struktura katalogów (`~/`)

Zasada dwufolderowa: pliki definicji stosów Docker Compose trafiają do
`docker/app/<usługa>/`, a dane trwałe (wolumeny, konfiguracje, bazy) do
`docker/app-data/<usługa>/`. Dzięki temu backup stanu serwera to
archiwizacja samego katalogu domowego (bez dużych bibliotek danych, które
powinny być montowane poza nim, np. w `/mnt/`).

```
~/
├── docker/
│   ├── app/
│   │   └── dockge/          # docker-compose.yml Dockge — pierwszy stos,
│   │                        #   tworzony od razu przez skrypt instalacyjny
│   └── app-data/
│       └── dockge/          # dane trwałe Dockge (jedyny podfolder tworzony od razu)
├── documentation/           # baza wiedzy
├── backups/                 # lokalne archiwa
├── blog/                    # (albo docs/ — do ustalenia)
└── creativity/              # szkice i proof-of-concept
```

Dockge nie jest wyjątkiem od zasady dwufolderowej — to po prostu pierwszy
stos, taki sam jak każdy kolejny. `docker/app/dockge/` i
`docker/app-data/dockge/` to jedyne podfoldery usług tworzone z góry przez
skrypt (bo Dockge musi już działać, żeby zarządzać resztą). Podfoldery
kolejnych usług (`docker/app/<nazwa>`, `docker/app-data/<nazwa>`) nie są
tworzone z góry — powstają dopiero, gdy dana usługa jest faktycznie
wdrażana (przez Dockge albo ręcznie).

`DOCKGE_STACKS_DIR` Dockge wskazuje na `docker/app/`, więc każdy nowy stos
założony w UI Dockge sam wyląduje jako `docker/app/<nazwa>/compose.yaml` —
zgodnie z konwencją (Dockge widzi wtedy też samego siebie jako jeden ze
stosów w tym katalogu).

## Jak bezpiecznie dodać nowy kontener (stos) przez Dockge (WAŻNE)

Dockge sam działa w kontenerze i uruchamia `docker compose` dla każdego
stosu przez `/var/run/docker.sock` — polecenia trafiają do prawdziwego
Dockera na hoście, ale **ścieżki względne w compose.yaml (`../../app-data/...`)
bywają zawodne**, jeśli coś w konfiguracji Dockge się nie zgadza (np. po
ręcznej edycji). Dla pewności — żeby dane na 100% trafiały tam, gdzie
powinny — rób tak przy każdym nowym stosie:

**1. Utwórz strukturę katalogów PRZED wdrożeniem kontenera** (zamień
`<nazwa-uslugi>` na nazwę stosu, np. `if-startpage`):

```
mkdir -p ~/docker/app-data/<nazwa-uslugi>/config
mkdir -p ~/docker/app-data/<nazwa-uslugi>/backups
```

**2. Nadaj właściwe uprawnienia** (na wypadek gdyby coś tworzyło pliki
jako root):

```
sudo chown -R $(whoami):$(whoami) ~/docker/app-data/<nazwa-uslugi>
```

**3. W pliku `compose.yaml` używaj PEŁNYCH ścieżek zaczynających się od
`/home/{user}/...`, a nie ścieżek względnych
(`../../app-data/...`)**. Sprawdź swoją nazwę użytkownika i katalog domowy
komendą `echo $HOME` (np. `/home/marek`) i wstaw ją bezpośrednio:

```yaml
    volumes:
      - /home/{user}/docker/app-data/<nazwa-uslugi>/config:/app/config
      - /home/{user}/docker/app-data/<nazwa-uslugi>/backups:/app/backups
```

zamiast:

```yaml
    volumes:
      - ../../app-data/<nazwa-uslugi>/config:/app/config    # NIE rob tak
      - ../../app-data/<nazwa-uslugi>/backups:/app/backups  # NIE rob tak
```

Pełna ścieżka zawsze wskazuje na to samo miejsce, niezależnie od tego, jak
Dockge akurat widzi swój katalog stosów — to najbezpieczniejszy wariant,
zwłaszcza że pakiet jest pomyślany dla osób nietechnicznych, które nie
będą w stanie samodzielnie zdiagnozować błędnie zamontowanego wolumenu.

## Plan rozwoju

- Pełne menu/TUI (na wzór KIAUH) do wyboru opcjonalnych komponentów —
  odłożone do czasu, aż zestaw komponentów się ustabilizuje.
- Kolejne komponenty opcjonalne na wzór `PRINT_SERVER_ROLE` (np. postfix).
- Docelowo publikacja jako publiczny instalator (GitHub).
