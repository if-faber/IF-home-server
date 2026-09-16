# myhome-install

Skrypt startowy serwera domowego **myhome** — uruchamiany raz na czystym
Debianie (instalacja netinst), instaluje i konfiguruje wszystko, co
potrzebne do działania serwera.

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

## Użycie

```sh
# lokalnie, po pobraniu repo / pliku
sudo ./install-myhome.sh
# albo, po "su -":
./install-myhome.sh

# uruchomienie przez potok (np. z Gitea/GitHub) — MUSISZ już być rootem,
# bo w potoku "$0" nie jest prawdziwym plikiem i skrypt nie może się sam
# podnieść przez sudo:
curl -fsSL <adres>/myhome-install.sh | bash
# albo bezpieczniej (pobierz, przejrzyj, potem uruchom):
curl -fsSL <adres>/myhome-install.sh -o install-myhome.sh
sudo bash install-myhome.sh
```

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
│   ├── docker-compose.yml   # Dockge — wyjątek od zasady dwufolderowej,
│   │                        # bo Dockge sam zarządza resztą stosów
│   ├── app/                 # docker-compose.yml kolejnych usług
│   └── app-data/            # dane trwałe kolejnych usług (w tym app-data/dockge)
├── documentation/           # baza wiedzy
├── backups/                 # lokalne archiwa
├── blog/                    # (albo docs/ — do ustalenia)
└── creativity/               # szkice i proof-of-concept
```

Podfoldery poszczególnych usług (`docker/app/<nazwa>`,
`docker/app-data/<nazwa>`) nie są tworzone z góry — powstają dopiero, gdy
dana usługa jest faktycznie wdrażana (przez Dockge albo ręcznie).

`DOCKGE_STACKS_DIR` Dockge wskazuje na `docker/app/`, więc każdy nowy stos
założony w UI Dockge sam wyląduje jako `docker/app/<nazwa>/compose.yaml` —
zgodnie z konwencją.

## Plan rozwoju

- Pełne menu/TUI (na wzór KIAUH) do wyboru opcjonalnych komponentów —
  odłożone do czasu, aż zestaw komponentów się ustabilizuje.
- Kolejne komponenty opcjonalne na wzór `PRINT_SERVER_ROLE` (np. postfix).
- Docelowo publikacja jako publiczny instalator (GitHub).
