#!/usr/bin/env bash
#
# install-myhome.sh
#
# Skrypt startowy serwera domowego "myhome" na czystym Debianie (netinst).
# Cel: uruchomiony raz na świeżym systemie, instaluje i konfiguruje wszystko,
# co potrzebne, tak aby przywrócenie serwera po awarii (obraz systemu +
# ten skrypt) trwało kilka minut.
#
# Użycie:
#   sudo ./install-myhome.sh
#   (albo, po "su -":  ./install-myhome.sh)
#
#   Uruchomienie przez potok (curl z Gitea) MUSI już być rootem,
#   bo w takim wypadku "$0" nie jest prawdziwym plikiem i skrypt nie może
#   sam się podnieść przez sudo:
#     curl -fsSL http://192.168.50.126:3000/gravi/IF-home-server/raw/branch/main/install-myhome.sh | bash
#     # gdy jesteś rootem, albo bezpieczniej:
#     curl -fsSL http://192.168.50.126:3000/gravi/IF-home-server/raw/branch/main/install-myhome.sh -o install-myhome.sh && sudo bash install-myhome.sh
#
# Automatyczne wykrywanie użytkownika docelowego (tego utworzonego podczas
# instalacji Debiana), w kolejności:
#   1. $SUDO_USER, jeśli skrypt wywołano przez sudo
#   2. `logname`, jeśli wywołano po "su -"
#   3. jedyne konto z UID >= 1000 w /etc/passwd
# Można to nadpisać ręcznie:
#   TARGET_USER=nazwa sudo -E ./install-myhome.sh
#
set -euo pipefail

LOG_FILE="/var/log/myhome-install.log"
# Jeśli z jakiegoś powodu nie da się pisać do /var/log/ (np. pozostałość po
# wcześniejszym teście z dziwnymi uprawnieniami/atrybutem pliku), nie wywalaj
# całego instalatora na samym starcie — przełącz się na /tmp.
if ! : >> "$LOG_FILE" 2>/dev/null; then
    LOG_FILE="/tmp/myhome-install.log"
fi
echo "=== myhome install: start $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"

# ---------------------------------------------------------------------------
# UI: kolory, licznik kroków, spinner dla długich komend
# ---------------------------------------------------------------------------
# Pełny, surowy output każdej komendy trafia WYŁĄCZNIE do $LOG_FILE. Na
# ekranie widać tylko czyste, kolorowe linie statusu — tak jak np. w
# instalatorach typu KIAUH albo get.docker.com. To na razie lekka wersja;
# pełne menu TUI (whiptail/dialog) to kolejny etap.
if [ -t 1 ]; then
    BOLD=$'\033[1m'; RESET=$'\033[0m'
    GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'
else
    BOLD=""; RESET=""; GREEN=""; RED=""; YELLOW=""; CYAN=""
fi

TOTAL_STEPS=10
STEP_NUM=0

step() {
    STEP_NUM=$((STEP_NUM + 1))
    local msg="[${STEP_NUM}/${TOTAL_STEPS}] $1"
    printf "\n%s%s%s\n" "${CYAN}${BOLD}" "$msg" "$RESET"
    echo ">>> $msg" >> "$LOG_FILE"
}

info() {
    printf "  %s\n" "$1"
    echo "  $1" >> "$LOG_FILE"
}

warn() {
    printf "  %s%s%s\n" "$YELLOW" "$1" "$RESET"
    echo "  UWAGA: $1" >> "$LOG_FILE"
}

fail() {
    printf "  %sBŁĄD:%s %s\n" "$RED" "$RESET" "$1" >&2
    echo "  BŁĄD: $1" >> "$LOG_FILE"
    exit 1
}

# run <opis> <polecenie...>
# Uruchamia polecenie w tle, pokazuje spinner, cały output kieruje do logu,
# na ekranie zostawia tylko krótki status OK/BŁĄD.
run() {
    local desc="$1"; shift
    echo "\$ $*" >> "$LOG_FILE"

    ( "$@" >>"$LOG_FILE" 2>&1 ) &
    local pid=$!
    local spin='|/-\'
    local i=0
    printf "  %s..." "$desc"
    while kill -0 "$pid" 2>/dev/null; do
        i=$(( (i + 1) % 4 ))
        printf "\r  %s... %s" "$desc" "${spin:$i:1}"
        sleep 0.15
    done

    if wait "$pid"; then
        printf "\r  %s... %sOK%s   \n" "$desc" "$GREEN" "$RESET"
    else
        printf "\r  %s... %sBŁĄD%s \n" "$desc" "$RED" "$RESET"
        echo "Szczegóły błędu w: $LOG_FILE" >&2
        exit 1
    fi
}

# run_sh <opis> <polecenie jako string dla bash -c>
# Jak run(), ale dla poleceń z potokami/przekierowaniami (np. "curl ... | bash").
run_sh() {
    local desc="$1"; shift
    run "$desc" bash -c "$1"
}

# ---------------------------------------------------------------------------
# 0. Uruchomienie z odpowiednimi uprawnieniami
# ---------------------------------------------------------------------------
# Na świeżym Debianie (netinst) pakiet sudo jeszcze nie istnieje, więc nie da
# się polegać na "sudo" przy pierwszym uruchomieniu — trzeba być już rootem
# (po "su -"). Jeśli sudo jest już zainstalowane (np. ponowne uruchomienie
# skryptu na skonfigurowanym systemie), można się nim wygodnie podnieść —
# ale TYLKO gdy "$0" to prawdziwy plik na dysku (nie działa dla
# "curl ... | bash", bo tam "$0" to po prostu "bash").
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1 && [ -f "$0" ] && [ -r "$0" ]; then
        info "Nie jestem rootem. Uruchamiam ponownie przez sudo..."
        exec sudo -E "$0" "$@"
    else
        echo "BŁĄD: ten skrypt musi być uruchomiony jako root." >&2
        echo "" >&2
        echo "Jeśli to świeży system (bez sudo) albo uruchamiasz przez potok" >&2
        echo "(curl | bash), zaloguj się jako root ('su -') i uruchom ponownie," >&2
        echo "albo: curl -fsSL <adres> -o install.sh && sudo bash install.sh" >&2
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Wykrycie użytkownika docelowego
# ---------------------------------------------------------------------------
detect_target_user() {
    local candidate

    if [ -n "${SUDO_USER-}" ] && [ "${SUDO_USER}" != "root" ]; then
        echo "${SUDO_USER}"
        return 0
    fi

    candidate="$(logname 2>/dev/null || true)"
    if [ -n "$candidate" ] && [ "$candidate" != "root" ]; then
        echo "$candidate"
        return 0
    fi

    candidate="$(awk -F: '$3>=1000 && $3<60000 && $1!="nobody"{print $1}' /etc/passwd | head -n1)"
    if [ -n "$candidate" ]; then
        echo "$candidate"
        return 0
    fi

    return 1
}

if [ -z "${TARGET_USER-}" ]; then
    if ! TARGET_USER="$(detect_target_user)"; then
        fail "nie udało się automatycznie wykryć użytkownika docelowego. Uruchom ponownie z: TARGET_USER=nazwa sudo -E $0"
    fi
fi

if ! id "$TARGET_USER" &>/dev/null; then
    fail "użytkownik '$TARGET_USER' nie istnieje w systemie."
fi

info "Użytkownik docelowy: $TARGET_USER"

# ---------------------------------------------------------------------------
# TUI: ekran powitalny + zbieranie danych instalacyjnych (whiptail)
# ---------------------------------------------------------------------------
# Przetestowane w sesji PuTTY (18.09.2026) — bez tej zmiennej ramki dialogów
# bywają "krzaczkowate" w PuTTY (konflikt ACS/UTF-8 w ncurses).
export NCURSES_NO_UTF8_ACS=1

if ! command -v whiptail >/dev/null 2>&1; then
    info "Instaluję whiptail (panel graficzny instalatora)..."
    apt update >>"$LOG_FILE" 2>&1 || true
    apt install -y whiptail >>"$LOG_FILE" 2>&1 || true
fi

USE_TUI=0
if command -v whiptail >/dev/null 2>&1 && [ -t 0 ] && [ -t 1 ]; then
    USE_TUI=1
fi

if [ "$USE_TUI" -eq 1 ]; then
    WELCOME_MSG="Witaj w instalatorze aplikacji systemowych dla domowego serwera.

Pomożemy Ci zainstalować niezbędne oprogramowanie do poprawnego \
funkcjonowania serwera, w przyjazny sposób.

Nie przerywaj raz rozpoczętego procesu instalacji — może to \
spowodować uszkodzenie instalacji i późniejsze problemy.

W trakcie instalacji możesz zostać poproszony o wpisanie danych \
niezbędnych do instalacji (np. haseł) — nie odchodź od komputera, \
aby móc je uzupełnić.

Gotowy?"

    if ! whiptail --title "Instalator serwera domowego" \
        --yes-button "Tak, zaczynamy" --no-button "Anuluj" \
        --yesno "$WELCOME_MSG" 20 70; then
        echo "Instalacja anulowana przez użytkownika." | tee -a "$LOG_FILE"
        exit 0
    fi
    whiptail --title "Instalator serwera domowego" --msgbox "Ruszamy i powodzenia!" 8 50

    # --- Rola drukowania (zastępuje ręczne PRINT_SERVER_ROLE=...) ---
    if whiptail --title "Serwer wydruku" \
        --yes-button "Tak, serwer" --no-button "Nie, tylko klient" \
        --yesno "Czy TEN komputer ma być serwerem wydruku — czyli będzie miał podłączoną fizyczną drukarkę i udostępni ją w sieci innym urządzeniom?

Wybierz 'Nie, tylko klient', jeśli chcesz tylko móc drukować na drukarce udostępnionej przez inny komputer/serwer w sieci (tak jest w większości domów, gdzie serwer wydruku już gdzieś działa)." 16 70; then
        PRINT_SERVER_ROLE="server"
    else
        PRINT_SERVER_ROLE="client"
    fi
    info "Rola drukowania: $PRINT_SERVER_ROLE"

    # --- Hasło do udostępniania plików w sieci (Samba) ---
    while true; do
        SMB_PASSWORD=$(whiptail --title "Udostępnianie plików w sieci" \
            --passwordbox "Ustaw hasło do udostępniania plików w sieci dla użytkownika '${TARGET_USER}'.

Będzie ono potrzebne na innych komputerach/urządzeniach w domu, żeby połączyć się z udostępnionymi folderami." \
            13 70 3>&1 1>&2 2>&3) || { echo "Instalacja anulowana przez użytkownika." | tee -a "$LOG_FILE"; exit 0; }

        SMB_PASSWORD_REPEAT=$(whiptail --title "Udostępnianie plików w sieci" \
            --passwordbox "Wpisz hasło jeszcze raz, żeby je potwierdzić." \
            10 70 3>&1 1>&2 2>&3) || { echo "Instalacja anulowana przez użytkownika." | tee -a "$LOG_FILE"; exit 0; }

        if [ -n "$SMB_PASSWORD" ] && [ "$SMB_PASSWORD" = "$SMB_PASSWORD_REPEAT" ]; then
            unset SMB_PASSWORD_REPEAT
            break
        fi
        whiptail --title "Udostępnianie plików w sieci" \
            --msgbox "Hasła się różnią albo pole było puste — spróbuj ponownie." 8 60
    done
    info "Hasło Samby ustawione (zostanie użyte w Kroku 6)."

    # --- Podsumowanie przed startem ---
    SUMMARY_MSG="Gotowe do instalacji.

Rola drukowania: $([ "$PRINT_SERVER_ROLE" = "server" ] && echo "serwer" || echo "tylko klient")
Hasło do udostępniania plików: ustawione

Rozpoczynamy właściwą instalację?"
    if ! whiptail --title "Instalator serwera domowego" \
        --yes-button "Tak, instaluj" --no-button "Anuluj" \
        --yesno "$SUMMARY_MSG" 14 60; then
        echo "Instalacja anulowana przez użytkownika." | tee -a "$LOG_FILE"
        exit 0
    fi
else
    warn "whiptail niedostępny albo brak terminala (np. uruchomienie przez 'curl | bash') — pomijam panel graficzny."
    PRINT_SERVER_ROLE="${PRINT_SERVER_ROLE:-client}"
    if [ -z "${SMB_PASSWORD-}" ]; then
        fail "brak panelu graficznego i brak zmiennej SMB_PASSWORD. Uruchom w prawdziwym terminalu (np. przez PuTTY), albo ustaw ręcznie: SMB_PASSWORD='...' TARGET_USER=... sudo -E $0"
    fi
fi


# ---------------------------------------------------------------------------
# Krok 0: sudo dla użytkownika docelowego
# ---------------------------------------------------------------------------
step "sudo, curl, git, lsb-release"

run "Aktualizacja listy pakietów" apt update
run "Instalacja sudo/curl/git/lsb-release" apt install -y sudo curl git lsb-release

usermod -aG sudo "$TARGET_USER"
echo "${TARGET_USER} ALL=(ALL) NOPASSWD: ALL" > "/etc/sudoers.d/${TARGET_USER}"
chmod 0440 "/etc/sudoers.d/${TARGET_USER}"
info "Dodano '${TARGET_USER}' do sudo (bez hasła)"

# ---------------------------------------------------------------------------
# Krok 1: wyciszenie GRUB / boot bez opóźnień
# ---------------------------------------------------------------------------
step "Quiet boot, wyciszenie logów jądra"

cat << 'EOF' > /etc/default/grub
GRUB_DEFAULT=0
GRUB_TIMEOUT=1
GRUB_RECORDFAIL_TIMEOUT=0
GRUB_DISTRIBUTOR=`lsb_release -i -s 2>/dev/null || echo Debian`
GRUB_CMDLINE_LINUX_DEFAULT="quiet loglevel=3 console=tty1"
GRUB_CMDLINE_LINUX=""
EOF
run "Aktualizacja GRUB-a" update-grub

echo "kernel.printk = 3 4 1 3" > /etc/sysctl.d/99-quiet-console.conf
run "Zastosowanie sysctl" sysctl -p /etc/sysctl.d/99-quiet-console.conf

# ---------------------------------------------------------------------------
# Krok 2: pakiety systemowe i zależności
# ---------------------------------------------------------------------------
step "Pakiety systemowe"

run "SSH i mDNS (.local)" apt install -y openssh-server avahi-daemon
run "Diagnostyka sprzętu (smartmontools, lm-sensors...)" apt install -y smartmontools lm-sensors sysstat htop

# Domyślnie tylko KLIENT druku — zakłada, że pełny serwer wydruku (CUPS)
# działa już gdzie indziej w sieci (tak jak u mnie). Jeśli to Twój PIERWSZY
# serwer domowy i chcesz też hostować drukarki stąd, uruchom skrypt z:
#   PRINT_SERVER_ROLE=server sudo -E ./install-myhome.sh
# (docelowo, gdy dojdzie menu/TUI, to będzie zwykła opcja do wyboru, tak jak
# np. postfix — kolejny kandydat na komponent opcjonalny, nie obowiązkowy)
PRINT_SERVER_ROLE="${PRINT_SERVER_ROLE:-client}"
if [ "$PRINT_SERVER_ROLE" = "server" ]; then
    run "Serwer druku (CUPS) + skanowanie" apt install -y cups sane-utils
else
    run "Klient druku (CUPS) + skanowanie" apt install -y cups-client sane-utils
fi

run "Protokoły sieciowe (NFS/CIFS)" apt install -y cifs-utils nfs-common
run "Python / Node.js" apt install -y nodejs python3-pip python3-venv

# ---------------------------------------------------------------------------
# Krok 3: Docker + Docker Compose
# ---------------------------------------------------------------------------
step "Docker"

run "Aktualizacja listy pakietów" apt update
run "Zależności (ca-certificates, gnupg...)" apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings

if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    run_sh "Klucz GPG Dockera" \
        "curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
fi
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

run "Aktualizacja listy pakietów" apt update
run "Instalacja silnika Docker" apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Grupa lpadmin istnieje tylko gdy zainstalowano pełny serwer CUPS
# (PRINT_SERVER_ROLE=server) — przy samym kliencie jej nie ma, więc nie da
# się do niej dopisać użytkownika.
if getent group lpadmin >/dev/null 2>&1; then
    usermod -aG docker,lpadmin "$TARGET_USER"
    info "Dodano '${TARGET_USER}' do grup docker i lpadmin"
else
    usermod -aG docker "$TARGET_USER"
    info "Dodano '${TARGET_USER}' do grupy docker (lpadmin pominięte — brak pełnego serwera CUPS)"
fi

# ---------------------------------------------------------------------------
# Krok 4: struktura katalogów myhome w katalogu domowym użytkownika
# ---------------------------------------------------------------------------
step "Struktura katalogów myhome"

USER_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
if [ -z "$USER_HOME" ] || [ ! -d "$USER_HOME" ]; then
    fail "nie udało się ustalić katalogu domowego użytkownika '$TARGET_USER'."
fi

# Zasada dwufolderowa: pliki definicji stosów -> docker/app/<usługa>/,
#                      dane trwałe (wolumeny/config/bazy) -> docker/app-data/<usługa>/
# Na razie tylko gałąź główna — poszczególne podfoldery usług (memos,
# homeassistant, gitea...) powstaną, gdy dana usługa będzie faktycznie
# wdrażana (przez Dockge albo ręcznie), zamiast tworzyć je z góry na zapas.
# Wyjątek: docker/app/dockge i docker/app-data/dockge powstają już teraz,
# w Kroku 5 — bo Dockge musi istnieć, zanim będzie mógł zarządzać resztą.
MYHOME_DIRS=(
    "docker/app"
    "docker/app-data"

    "documentation"
    "backups"
    "blog"
    "creativity"
)

for d in "${MYHOME_DIRS[@]}"; do
    mkdir -p "${USER_HOME}/${d}"
done

chown -R "${TARGET_USER}:${TARGET_USER}" \
    "${USER_HOME}/docker" \
    "${USER_HOME}/documentation" \
    "${USER_HOME}/backups" \
    "${USER_HOME}/blog" \
    "${USER_HOME}/creativity"

info "Utworzono: docker/app, docker/app-data, documentation, backups, blog, creativity"
warn "Duże biblioteki danych (zdjęcia, filmy, skany NAS) montuj poza \$HOME, np. w /mnt/ — pełny backup to archiwizacja samego \$HOME."

# ---------------------------------------------------------------------------
# Krok 5: Dockge — instalowany jako pierwszy stos, zarządza kolejnymi
# ---------------------------------------------------------------------------
step "Dockge"

# Dockge NIE jest wyjątkiem od zasady dwufolderowej — to po prostu pierwszy
# stos, taki sam jak każdy przyszły: plik definicji w docker/app/dockge/,
# dane trwałe w docker/app-data/dockge/. Jedyna różnica: te dwa foldery
# tworzymy tu ręcznie (i od razu odpalamy stos), zamiast czekać, aż powstaną
# przez UI Dockge — bo Dockge musi już działać, żeby mógł zarządzać resztą.
# Jego katalog stosów (DOCKGE_STACKS_DIR) wskazuje na docker/app/, więc każdy
# kolejny stos utworzony w UI Dockge sam wyląduje jako
# docker/app/<nazwa>/compose.yaml — zgodnie z konwencją (Dockge widzi wtedy
# też samego siebie jako jeden ze stosów w tym katalogu).
mkdir -p "${USER_HOME}/docker/app/dockge" "${USER_HOME}/docker/app-data/dockge"

cat << 'EOF' > "${USER_HOME}/docker/app/dockge/docker-compose.yml"
services:
  dockge:
    image: louislam/dockge:1.5.0
    container_name: dockge
    restart: unless-stopped
    ports:
      - "5001:5001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ../../app-data/dockge:/app/data
      - ../:/opt/stacks
    environment:
      - DOCKGE_STACKS_DIR=/opt/stacks
EOF

chown -R "${TARGET_USER}:${TARGET_USER}" "${USER_HOME}/docker"

run "Uruchomienie Dockge" docker compose -f "${USER_HOME}/docker/app/dockge/docker-compose.yml" up -d

info "Dockge będzie dostępne pod: http://<adres-serwera>:5001"

# ---------------------------------------------------------------------------
# Krok 6: Samba
# ---------------------------------------------------------------------------
step "Samba"

run "Aktualizacja listy pakietów" apt update
run "Instalacja Samby" apt install -y samba samba-common-bin
run "Włączenie usług smbd/nmbd" systemctl enable --now smbd nmbd

if [ -n "${SMB_PASSWORD-}" ]; then
    info "Ustawianie hasła Samby dla '${TARGET_USER}' (zebrane wcześniej w panelu)..."
    if smbpasswd -a -s "$TARGET_USER" >>"$LOG_FILE" 2>&1 <<SMBPASS_EOF
$SMB_PASSWORD
$SMB_PASSWORD
SMBPASS_EOF
    then
        info "Hasło Samby ustawione."
    else
        fail "nie udało się ustawić hasła Samby (zobacz $LOG_FILE)."
    fi
    unset SMB_PASSWORD
else
    info "Ustaw hasło Samby dla '${TARGET_USER}' (wymagane interaktywnie):"
    smbpasswd -a "$TARGET_USER"
fi

# ---------------------------------------------------------------------------
# Krok 7: Cockpit + wtyczki
# ---------------------------------------------------------------------------
step "Cockpit i wtyczki"

run "Instalacja Cockpit" apt install -y cockpit
run "Włączenie cockpit.socket" systemctl enable --now cockpit.socket

run "Oficjalny dodatek: diagnostyka (sosreport)" apt install -y cockpit-sosreport

# Wtyczki 45Drives (Navigator, File Sharing, Identities)
run_sh "Repozytorium 45Drives" "curl -sSL https://repo.45drives.com/setup | bash"
run "Aktualizacja listy pakietów" apt update
run "Wtyczki 45Drives" apt install -y cockpit-navigator cockpit-file-sharing cockpit-identities

# Wtyczki z GitHub
rm -rf /usr/share/cockpit/explorer
run "Wtyczka: Explorer" git clone --depth 1 https://github.com/ismetozalp/explorer.git /usr/share/cockpit/explorer

echo "deb [trusted=yes arch=all] https://chrisjbawden.github.io/cockpit-dockermanager stable main" \
  > /etc/apt/sources.list.d/cockpit-dockermanager.list
run "Aktualizacja listy pakietów" apt update
run "Wtyczka: Docker Manager" apt install -y dockermanager

# Wtyczka Sensors (ocristopfer/cockpit-sensors) ŚWIADOMIE pominięta: pokazuje
# temperatury tylko w Fahrenheitach (nieprzydatne), a CTOP (już zainstalowany
# niżej) i tak pokazuje temperatury nvme/CPU/WiFi/GPU w Celsjuszach — Sensors
# dublowałby tę funkcję bez żadnej przewagi, a wymagał dodatkowego kroku
# budowania (make + npm).

# Wtyczka Compose (RXTX4816/cockpit-compose) ŚWIADOMIE pominięta: dubluje
# funkcję, którą już mamy w Dockge (zarządzanie stosami Docker Compose), a
# wymaga Node.js 22+ do zbudowania (tu mamy 20.x) — niepotrzebna złożoność
# dla funkcji, którą i tak robi Dockge. Szablony compose.yaml dla
# poszczególnych usług będą opisane w dokumentacji (ideaforge.pl), nie w
# osobnej wtyczce Cockpit.

rm -rf /usr/share/cockpit/ctop
run "Wtyczka: CTOP" git clone --depth 1 https://github.com/ismetozalp/ctop.git /usr/share/cockpit/ctop

# Sprzątanie i uprawnienia
find /usr/share/cockpit/ -type d -name ".git" -exec rm -rf {} +
chmod -R 755 /usr/share/cockpit/

run "Restart Cockpit" systemctl restart cockpit

# ---------------------------------------------------------------------------
# Krok 8: Cockpit PCP (statystyki wydajności)
# ---------------------------------------------------------------------------
step "Cockpit PCP"

run "Aktualizacja listy pakietów" apt update
run "Instalacja PCP" apt install -y cockpit-pcp pcp python3-pcp

# Pakiet "pcp" instaluje pmcd/pmlogger/pmie/pmproxy jako natywne usługi
# systemd i sam je włącza przy instalacji. "pcp" to za to stary skrypt
# SysV (init.d) bez ustawionych runlevels — próba "systemctl enable pcp"
# kończy się błędem update-rc.d ("Default-Start contains no runlevels").
# Dlatego włączamy tylko pmcd, a nie "pcp".
run "Włączenie pmcd" systemctl enable --now pmcd
run "Restart Cockpit" systemctl restart cockpit

# ---------------------------------------------------------------------------
# Krok 9: wyłączenie zbędnych usług
# ---------------------------------------------------------------------------
step "Wyłączenie zbędnych usług"

systemctl disable --now colord.service >>"$LOG_FILE" 2>&1 || true
systemctl mask colord.service >>"$LOG_FILE" 2>&1
info "Wyłączono i zamaskowano colord"

systemctl disable --now nfs-blkmap.service >>"$LOG_FILE" 2>&1 || true
systemctl mask nfs-blkmap.service >>"$LOG_FILE" 2>&1
info "Wyłączono i zamaskowano nfs-blkmap"

# ---------------------------------------------------------------------------
printf "\n%s%s=== myhome install: koniec %s ===%s\n" "$GREEN" "$BOLD" "$(date '+%Y-%m-%d %H:%M:%S')" "$RESET"
echo "=== myhome install: koniec $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"
info "Pełny log instalacji: $LOG_FILE"

SERVER_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src"){print $(i+1); exit}}')"
[ -z "$SERVER_IP" ] && SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "$SERVER_IP" ] && SERVER_IP="<adres IP tego serwera>"

if [ "${USE_TUI:-0}" -eq 1 ]; then
    FINAL_MSG="Gratulacje! Wszystkie aplikacje zostały zainstalowane.

Dostęp do aplikacji znajdziesz w instrukcji na stronie startowej: http://${SERVER_IP}

Aby dokończyć proces, należy ponownie uruchomić komputer."

    if whiptail --title "Instalator serwera domowego" \
        --yes-button "Uruchom ponownie" --no-button "Później" \
        --yesno "$FINAL_MSG" 14 70; then
        info "Restart systemu na życzenie użytkownika..."
        reboot
    else
        info "Restart odłożony — pamiętaj, żeby uruchomić komputer ponownie: sudo reboot"
    fi
else
    info "Dostęp do aplikacji: http://${SERVER_IP}"
    info "Zalecany restart systemu: sudo reboot"
fi
