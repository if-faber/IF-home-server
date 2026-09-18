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

- Czysty Debian (netinst), zalogowany jako **root** (`su -`) — na świeżym
  systemie `sudo` jeszcze nie istnieje, więc skrypt musi być uruchomiony
  wprost jako root.
- Dostęp do internetu (pobiera pakiety z apt, repozytoria Dockera i
  wtyczek Cockpit z GitHuba).

## Pierwsze kroki na zupełnie nowym Debianie (WAŻNE — przeczytaj przed instalacją)

Świeży Debian (netinst) **domyślnie nie ma ani `curl`, ani `sudo`**. Co
więcej — jeśli podczas instalacji Debiana ustawiłeś hasło dla konta
**root**, Twoje zwykłe konto użytkownika **nie dostaje automatycznie**
uprawnień administratora. To normalne działanie Debiana, nie błąd i nie
usterka tego instalatora. Zrób to raz, zanim uruchomisz cokolwiek innego —
wykonuj polecenia dokładnie w tej kolejności:

1. Połącz się z serwerem (np. przez PuTTY) i zaloguj się jako swój zwykły
   użytkownik.
2. Przełącz się na konto root:
   ```sh
   su -
   ```
   Zapyta o hasło — podaj hasło **roota**, czyli to, które ustawiłeś
   podczas instalacji Debiana (NIE hasło swojego zwykłego konta, jeśli są
   różne). Prompt zmieni się na coś w stylu `root@nazwa-serwera:~#`.
3. Zainstaluj `sudo` i dodaj do niego swojego użytkownika (**podmień
   `twoja-nazwa` na swoją prawdziwą nazwę użytkownika**, tę której użyłeś
   przy logowaniu w kroku 1):
   ```sh
   apt-get update
   apt-get install -y sudo
   usermod -aG sudo twoja-nazwa
   ```
4. Wyjdź z sesji roota:
   ```sh
   exit
   ```
5. **Zamknij całe okno PuTTY i połącz się jeszcze raz od nowa** (samo
   `exit` nie wystarczy). To konieczne, żeby system zauważył nowe
   uprawnienia — bez tego kroku `sudo` i tak zwróci błąd, że nie jesteś w
   pliku sudoers.
6. Po ponownym zalogowaniu sprawdź, czy `sudo` działa, i zainstaluj
   `curl` (poda hasło swojego **zwykłego** użytkownika, nie roota):
   ```sh
   sudo apt-get install -y curl
   ```

Dopiero teraz masz `curl` i działające `sudo` — możesz przejść do
instalacji poniżej.

## Użycie

```sh
# lokalnie, po pobraniu repo / pliku
sudo ./install-myhome.sh
# albo, po "su -":
./install-myhome.sh
```

**Z GitHuba** (publiczne, spoza sieci domowej), po wykonaniu kroków
powyżej:

```sh
curl -fsSL https://raw.githubusercontent.com/if-faber/IF-home-server/main/install-myhome.sh -o install-myhome.sh
sudo bash install-myhome.sh
```

> Wewnętrzny adres LAN (Gitea) dla prac rozwojowych w sieci domowej nie
> jest tu publikowany — kod na Gitea i GitHubie jest identyczny, więc do
> instalacji zawsze wystarczy publiczny adres z GitHuba powyżej.

### Zmienne środowiskowe (konfiguracja)

| Zmienna             | Domyślnie          | Znaczenie |
|---------------------|--------------------|-----------|
| `TARGET_USER`        | autodetekcja       | Użytkownik, dla którego konfigurowane są sudo/docker/samba/struktura katalogów. Autodetekcja: `$SUDO_USER` → `logname` → jedyne konto UID≥1000 w `/etc/passwd`. |
| `PRINT_SERVER_ROLE`  | `client`           | `client` instaluje tylko klienta CUPS (zakłada, że pełny serwer druku działa gdzie indziej w sieci). `server` instaluje pełny serwer CUPS — wybierz to, jeśli to Twój pierwszy serwer domowy i chcesz też hostować drukarki. |

Przykład: `TARGET_USER=darek PRINT_SERVER_ROLE=server sudo -E ./install-myhome.sh`

## Co instaluje skrypt (kolejność)

0. **sudo** dla wykrytego użytkownika (bez hasła), curl, git, lsb-release.
1. **Quiet boot** — wyciszenie GRUB-a i logów jądra na konsoli.
2. **Pakiety systemowe** — SSH, avahi (mDNS/.local), smartmontools/lm-sensors/sysstat/htop (diagnostyka), CUPS (klient lub serwer, patrz `PRINT_SERVER_ROLE`), sane-utils, cifs-utils/nfs-common (NFS/CIFS), nodejs, python3-pip, python3-venv.
3. **Docker + Docker Compose** (oficjalne repozytorium Dockera). Użytkownik docelowy dopisywany do grup `docker` (i `lpadmin`, jeśli istnieje — czyli tylko przy pełnym serwerze CUPS).
4. **Struktura katalogów myhome** w katalogu domowym użytkownika (patrz niżej).
5. **Dockge** — menedżer stosów Docker Compose, instalowany jako pierwszy stos i od razu uruchamiany (port 5001).
6. **Samba** — instalacja, włączenie usług, ustawienie hasła sieciowego dla użytkownika (jedyny krok wymagający ręcznej interakcji).
7. **Cockpit** + wtyczki (45Drives: Navigator, File Sharing, Identities; z GitHuba: Explorer, Docker Manager, Sensors, Compose, CTOP).
8. **Cockpit PCP** — statystyki wydajności.
9. **Wyłączenie zbędnych usług** (colord, nfs-blkmap).

Cały surowy output komend trafia do `/var/log/myhome-install.log` — na
ekranie widać tylko czyste, kolorowe statusy (`[n/10] ... OK`).

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
`/home/<Twoja-nazwa-użytkownika>/...`, a nie ścieżek względnych
(`../../app-data/...`)**. Sprawdź swoją nazwę użytkownika i katalog domowy
komendą `echo $HOME` (np. `/home/marek`) i wstaw ją bezpośrednio:

```yaml
    volumes:
      - /home/TWOJA-NAZWA-UZYTKOWNIKA/docker/app-data/<nazwa-uslugi>/config:/app/config
      - /home/TWOJA-NAZWA-UZYTKOWNIKA/docker/app-data/<nazwa-uslugi>/backups:/app/backups
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
