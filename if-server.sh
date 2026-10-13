#!/usr/bin/env bash
#
# if-server.sh — narzędzie serwera domowego IF-home-server (jak KIAUH dla Klippera)
#
# Mieszka w /opt/if-home-server (kopia repozytorium z GitHuba w konkretnej
# wersji) i jest dostępne jako polecenie:
#   sudo if-server
#
# Pierwsza instalacja narzędzia:
#   sudo git clone https://github.com/if-faber/IF-home-server.git /opt/if-home-server
#   sudo /opt/if-home-server/if-server.sh
#
# Wersje to tagi repozytorium w postaci vX.Y.Z. Opis tagu = „Co nowego”.
# Przy starcie narzędzie sprawdza, czy w repozytorium (origin) jest nowsza
# wersja, pokazuje „Co nowego” i pyta: aktualizuj / zostań na obecnej.
#
# Składniki serwera (Docker, Samba, Cockpit...) są opisane w skladniki/*.sh.
# Co jest zainstalowane i w jakiej wersji przepisu — w pliku stanu
# /etc/if-home-server/stan.conf. Serwer zainstalowany starym skryptem
# (install-myhome.sh) jest przy starcie rozpoznawany i zapisywany w stanie
# — bez instalowania czegokolwiek.
#
set -euo pipefail

INSTALL_DIR="/opt/if-home-server"
COMMAND_LINK="/usr/local/bin/if-server"
LOG_FILE="/var/log/if-server.log"
STATE_DIR="/etc/if-home-server"
STATE_FILE="$STATE_DIR/stan.conf"
TITLE="IF-home-server"

SELF="$(readlink -f "${BASH_SOURCE[0]}")"
APP_DIR="$(dirname "$SELF")"
COMPONENTS_DIR="$APP_DIR/skladniki"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"
}

# ---------------------------------------------------------------------------
# Wersje narzędzia
# ---------------------------------------------------------------------------
repo_git() {
    git -C "$APP_DIR" "$@"
}

# Obecna wersja: tag vX.Y.Z wskazujący dokładnie na HEAD albo, dla kopii
# roboczej, najbliższy tag + skrót commita.
current_version() {
    repo_git describe --tags --match 'v[0-9]*' --always 2>/dev/null || echo "nieznana"
}

# Najbliższy tag wersji (bez dopisku o commicie) — do porównań.
current_base_version() {
    repo_git describe --tags --match 'v[0-9]*' --abbrev=0 2>/dev/null || echo "v0.0.0"
}

# Wszystkie wersje vX.Y.Z w repozytorium origin, od najstarszej.
remote_versions() {
    repo_git ls-remote --tags --refs origin 'v*' 2>>"$LOG_FILE" \
        | sed 's#.*refs/tags/##' \
        | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' \
        | sort -V
}

# version_gt A B — prawda, gdy A jest nowsza niż B.
version_gt() {
    [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]
}

# Opisy wersji nowszych niż obecna, od najnowszej.
whats_new() {
    local base="$1"; shift
    local tag
    for tag in "$@"; do
        if version_gt "$tag" "$base"; then
            printf '=== %s ===\n' "$tag"
            # Opis tagu kończy się pustą linią — ona oddziela kolejne wersje.
            repo_git tag -l --format='%(contents)' "$tag"
        fi
    done
}

check_for_update() {
    local quiet="${1-}"
    local base latest versions=()

    base="$(current_base_version)"
    log "Sprawdzam aktualizacje (obecna: $(current_version))"

    if ! mapfile -t versions < <(remote_versions) || [ "${#versions[@]}" -eq 0 ]; then
        log "Nie udało się pobrać listy wersji albo lista jest pusta"
        if [ -z "$quiet" ]; then
            whiptail --title "$TITLE" --msgbox \
                "Nie udało się sprawdzić, czy jest nowsza wersja.\n\nSprawdź połączenie z internetem. Szczegóły: $LOG_FILE" 12 64
        fi
        return 0
    fi
    latest="${versions[-1]}"

    if ! version_gt "$latest" "$base"; then
        log "Brak nowszej wersji (najnowsza: $latest)"
        if [ -z "$quiet" ]; then
            whiptail --title "$TITLE" --msgbox \
                "Masz najnowszą wersję: $(current_version)" 10 60
        fi
        return 0
    fi

    # Pobranie opisów nowych wersji (nie zmienia zainstalowanych plików).
    if ! repo_git fetch --quiet --tags origin >>"$LOG_FILE" 2>&1; then
        log "Nie udało się pobrać nowych wersji"
        whiptail --title "$TITLE" --msgbox \
            "Jest nowsza wersja ($latest), ale nie udało się jej pobrać.\n\nSzczegóły: $LOG_FILE" 12 64
        return 0
    fi

    local reversed=() i
    for (( i=${#versions[@]}-1; i>=0; i-- )); do
        reversed+=("${versions[i]}")
    done
    whats_new "$base" "${reversed[@]}" > "/tmp/if-server-co-nowego.txt"
    whiptail --title "Co nowego — $latest" --scrolltext \
        --textbox "/tmp/if-server-co-nowego.txt" 22 76
    rm -f "/tmp/if-server-co-nowego.txt"

    if ! whiptail --title "$TITLE" \
        --yes-button "Aktualizuj" --no-button "Zostań na obecnej" \
        --yesno "Jest nowsza wersja narzędzia.\n\nZainstalowana: $(current_version)\nDostępna:      $latest\n\nZaktualizować teraz?" 14 64; then
        log "Użytkownik został na obecnej wersji"
        return 0
    fi

    if ! repo_git -c advice.detachedHead=false checkout --quiet "$latest" >>"$LOG_FILE" 2>&1; then
        log "Aktualizacja do $latest nie powiodła się"
        whiptail --title "$TITLE" --msgbox \
            "Aktualizacja nie powiodła się — zostaje obecna wersja.\n\nSzczegóły: $LOG_FILE" 12 64
        return 0
    fi

    log "Zaktualizowano do $latest"
    whiptail --title "$TITLE" --msgbox \
        "Zaktualizowano do wersji $latest.\n\nUruchamiam nową wersję." 10 60
    exec "$SELF"
}

# ---------------------------------------------------------------------------
# Użytkownik serwera (ten utworzony podczas instalacji Debiana)
# ---------------------------------------------------------------------------
# Kolejność jak w install-myhome.sh: $SUDO_USER → logname → jedyne konto UID ≥ 1000.
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

# ---------------------------------------------------------------------------
# Składniki
# ---------------------------------------------------------------------------
# Pomocnicze funkcje dla plików skladniki/*.sh.
pakiet_jest() {
    if [ "$(dpkg-query -W -f='${Status}' "$1" 2>/dev/null)" = "install ok installed" ]; then
        return 0
    fi
    # Pakiet „wirtualny” — dostarcza go inny pakiet. Np. w Debianie 13 nie ma
    # osobnego cockpit-pcp: wykresy są w cockpit-bridge (Provides: cockpit-pcp).
    # awk czyta całą listę do końca (grep -q zamknąłby potok wcześniej, a przy
    # pipefail przerwany dpkg-query dałby błąd mimo trafienia).
    dpkg-query -W -f='${Status}|${Provides}\n' 2>/dev/null \
        | awk -F'|' -v p="$1" '
            $1 == "install ok installed" {
                n = split($2, list, /, */)
                for (i = 1; i <= n; i++) { split(list[i], w, " "); if (w[1] == p) found = 1 }
            }
            END { exit !found }'
}

# Wypisuje pakiety, których brakuje (po jednym w linii).
brak_pakietow() {
    local p
    for p in "$@"; do
        pakiet_jest "$p" || echo "$p"
    done
}

# Identyfikator składnika z nazwy pliku: skladniki/05-docker.sh → docker
component_id() {
    local name
    name="$(basename "$1" .sh)"
    echo "${name#[0-9][0-9]-}"
}

# Sprawdza jeden składnik. Wypisuje jedną linię rozdzieloną znakiem „|”:
#   id|nazwa|wersja przepisu|stan|braki|info
# stan: jest / niepelny / brak
check_component() {
    local file="$1"
    (
        # shellcheck disable=SC1090
        source "$file"
        local out rc=0 missing info state
        out="$(sprawdz)" || rc=$?
        info="$(printf '%s\n' "$out" | sed -n 's/^info: //p' | paste -sd ',' - | sed 's/,/, /g')"
        missing="$(printf '%s\n' "$out" | grep -v '^info: ' | grep . | paste -sd ',' - | sed 's/,/, /g' || true)"
        if [ "$rc" -ne 0 ]; then
            state="brak"
        elif [ -n "$missing" ]; then
            state="niepelny"
        else
            state="jest"
        fi
        printf '%s|%s|%s|%s|%s|%s\n' "$(component_id "$file")" "$NAZWA" "$WERSJA" "$state" "$missing" "$info"
    )
}

check_all_components() {
    local file
    for file in "$COMPONENTS_DIR"/[0-9][0-9]-*.sh; do
        [ -f "$file" ] || continue
        check_component "$file"
    done
}

# ---------------------------------------------------------------------------
# Instalacja: na ekranie krótkie linie statusu, pełny wynik poleceń w dzienniku
# (tak jak w install-myhome.sh)
# ---------------------------------------------------------------------------
BOLD=$'\033[1m'; RESET=$'\033[0m'
GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'

info() {
    printf "  %s\n" "$1"
    echo "  $1" >> "$LOG_FILE"
}

warn() {
    printf "  %s%s%s\n" "$YELLOW" "$1" "$RESET"
    echo "  UWAGA: $1" >> "$LOG_FILE"
}

# run <opis> <polecenie...> — polecenie w tle ze wskaźnikiem postępu.
# Błąd = kod 1 (przy set -e w przepisie składnika przerywa jego instalację).
run() {
    local desc="$1"; shift
    echo "\$ $*" >> "$LOG_FILE"

    ( "$@" >>"$LOG_FILE" 2>&1 ) &
    local pid=$!
    # shellcheck disable=SC1003  # ukośnik to znak wskaźnika, nie ucieczka
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
        return 1
    fi
}

# run_sh <opis> <polecenie jako tekst dla bash -c> — dla potoków i przekierowań.
run_sh() {
    local desc="$1"; shift
    run "$desc" bash -c "$1"
}

# ---------------------------------------------------------------------------
# Upgrade: instalacja nowych, uzupełnienie niepełnych, aktualizacja przepisów
# ---------------------------------------------------------------------------
# Składniki do zrobienia, po jednym w linii: plik|id|nazwa|powód
upgrade_candidates() {
    local file id name version state missing info saved s_ver reason
    for file in "$COMPONENTS_DIR"/[0-9][0-9]-*.sh; do
        [ -f "$file" ] || continue
        IFS='|' read -r id name version state missing info < <(check_component "$file")
        saved="$(state_get "$id")"
        s_ver="${saved%% *}"
        reason=""
        case "$state" in
            brak)     reason="nowy" ;;
            niepelny)
                # Na liście Upgrade mieści się ok. 40 znaków opisu; pełna lista braków
                # jest w Stanie serwera.
                if [ "${#missing}" -le 30 ]; then
                    reason="niepełny, brakuje: $missing"
                else
                    reason="niepełny (braki: Stan serwera)"
                fi
                ;;
            jest)
                if [ -n "$s_ver" ] && [ "$s_ver" -lt "$version" ]; then
                    reason="nowy przepis $s_ver → $version"
                fi
                ;;
        esac
        if [ -n "$reason" ]; then
            printf '%s|%s|%s|%s\n' "$file" "$id" "$name" "$reason"
        fi
    done
}

# Zalecany restart po zmianach w rozruchu albo w grupach użytkownika.
needs_reboot() {
    case "$1" in
        podstawy|cichy-start|druk|docker) return 0 ;;
    esac
    return 1
}

run_upgrade() {
    local lines=() line file id name reason args=() chosen selected=() files=() names=()
    local answers i rc state done_count=0 failed="" reboot=0

    mapfile -t lines < <(upgrade_candidates)
    if [ "${#lines[@]}" -eq 0 ]; then
        whiptail --title "Upgrade" --msgbox "Wszystkie składniki są zainstalowane i aktualne." 9 60
        return 0
    fi

    for line in "${lines[@]}"; do
        IFS='|' read -r file id name reason <<< "$line"
        args+=("$id" "$name — $reason" ON)
    done
    # --notags: na liście tylko opisy, bez technicznych nazw składników.
    chosen=$(whiptail --title "Upgrade" --notags --checklist \
        "Zaznaczone składniki zostaną zainstalowane albo uzupełnione.\nSpacja — zaznacz / odznacz, Enter — dalej." \
        20 78 12 "${args[@]}" 3>&1 1>&2 2>&3) || return 0
    read -ra selected <<< "${chosen//\"/}"
    [ "${#selected[@]}" -gt 0 ] || return 0

    # Kolejność jak na liście (numery plików) — np. Docker przed Dockge.
    for line in "${lines[@]}"; do
        IFS='|' read -r file id name reason <<< "$line"
        if [[ " ${selected[*]} " == *" $id "* ]]; then
            files+=("$file")
            names+=("$name")
        fi
    done

    # Pytania wszystkich składników najpierw — potem instalacja bez przerw.
    mkdir -p "$STATE_DIR"
    answers="$(mktemp "$STATE_DIR/.odpowiedzi.XXXXXX")"
    chmod 600 "$answers"
    for file in "${files[@]}"; do
        # shellcheck disable=SC1090
        if ! ( source "$file"; if declare -F pytania >/dev/null; then ODPOWIEDZI="$answers" pytania; fi ); then
            rm -f "$answers"
            whiptail --title "Upgrade" --msgbox "Anulowano — nic nie zostało zainstalowane." 9 60
            return 0
        fi
    done

    if ! whiptail --title "Upgrade" --yes-button "Instaluj" --no-button "Anuluj" \
        --yesno "Do zainstalowania:\n\n$(printf ' - %s\n' "${names[@]}")\n\nZaczynamy?" 22 70; then
        rm -f "$answers"
        return 0
    fi

    clear
    printf "%s%s=== Upgrade: %d składn. ===%s\n" "$CYAN" "$BOLD" "${#files[@]}" "$RESET"
    log "Upgrade: ${selected[*]}"
    export DEBIAN_FRONTEND=noninteractive
    if ! run "Aktualizacja listy pakietów" apt-get update; then
        failed="lista pakietów"
    fi

    for i in "${!files[@]}"; do
        [ -z "$failed" ] || break
        file="${files[$i]}"
        id="$(component_id "$file")"
        printf "\n%s%s[%d/%d] %s%s\n" "$CYAN" "$BOLD" $((i + 1)) "${#files[@]}" "${names[$i]}" "$RESET"
        echo ">>> Składnik: $id" >> "$LOG_FILE"

        # Przepis w osobnej powłoce z set -e: pierwszy błąd przerywa ten składnik.
        set +e
        (
            set -e
            # shellcheck disable=SC1090
            source "$file"
            # shellcheck disable=SC1090
            source "$answers"
            zainstaluj
        )
        rc=$?
        set -e

        state="$(check_component "$file" | cut -d'|' -f4)"
        if [ "$rc" -eq 0 ] && [ "$state" = "jest" ]; then
            # shellcheck disable=SC1090
            state_set "$id" "$(source "$file"; echo "$WERSJA")" zainstalowany
            log "Zainstalowano składnik: $id"
            done_count=$((done_count + 1))
            if needs_reboot "$id"; then
                reboot=1
            fi
        else
            failed="${names[$i]}"
            log "Błąd instalacji składnika: $id (kod $rc, stan po: $state)"
        fi
    done
    rm -f "$answers"

    echo
    if [ -z "$failed" ]; then
        printf "%s%sGotowe: zainstalowano %d z %d.%s\n" "$GREEN" "$BOLD" "$done_count" "${#files[@]}" "$RESET"
    else
        printf "%s%sPrzerwano na: %s. Zainstalowano %d z %d.%s\n" "$RED" "$BOLD" "$failed" "$done_count" "${#files[@]}" "$RESET"
        echo "  Szczegóły w dzienniku: $LOG_FILE"
    fi
    if [ "$reboot" -eq 1 ]; then
        warn "Zalecany restart serwera: sudo reboot"
    fi
    echo
    read -rp "Naciśnij Enter, aby wrócić do menu... " _
}

# ---------------------------------------------------------------------------
# Plik stanu: /etc/if-home-server/stan.conf
# ---------------------------------------------------------------------------
# Linia: <składnik> <wersja przepisu> <data> <skąd: zainstalowany / rozpoznany>
state_get() {
    [ -f "$STATE_FILE" ] || return 0
    awk -v id="$1" '$1==id {print $2" "$3" "$4}' "$STATE_FILE"
}

state_set() {
    local id="$1" version="$2" how="$3" tmp
    mkdir -p "$STATE_DIR"
    tmp="$(mktemp "$STATE_FILE.XXXXXX")"
    {
        echo "# IF-home-server — stan serwera (zapisuje if-server, nie edytuj ręcznie)"
        echo "# składnik  wersja-przepisu  data  skąd"
        if [ -f "$STATE_FILE" ]; then
            awk -v id="$id" '!/^#/ && NF && $1!=id' "$STATE_FILE"
        fi
        echo "$id $version $(date '+%Y-%m-%d') $how"
    } > "$tmp"
    chmod 644 "$tmp"
    mv -f "$tmp" "$STATE_FILE"
}

# Składniki, które są na serwerze, a nie ma ich w stanie (serwer zainstalowany
# starym skryptem albo ręcznie), zapisuje jako „rozpoznany” w wersji 1 —
# tak, jak instalował je install-myhome.sh. Niepełnych nie zapisuje: „Upgrade”
# potraktuje je jak nowe i uzupełni.
recognize_components() {
    local id name version state missing info found=()
    while IFS='|' read -r id name version state missing info; do
        if [ "$state" = "jest" ] && [ -z "$(state_get "$id")" ]; then
            state_set "$id" 1 rozpoznany
            found+=("$name")
            log "Rozpoznano składnik: $id"
        fi
    done < <(check_all_components)

    if [ "${#found[@]}" -gt 0 ]; then
        whiptail --title "$TITLE" --msgbox \
"Rozpoznałem składniki, które już są na tym serwerze (liczba: ${#found[@]}).

Zapisałem je w stanie serwera — nic nie zostało zainstalowane ani zmienione.

Szczegóły: menu → Stan serwera." 14 70
    fi
}

# Dopełnia tekst spacjami do podanej liczby znaków (liczy litery, nie bajty —
# ważne dla polskich znaków).
pad() {
    local text="$1" width="$2"
    printf '%s' "$text"
    if [ "${#text}" -lt "$width" ]; then
        printf '%*s' $(( width - ${#text} )) ''
    fi
}

# Dopisek pod składnikiem w drugiej kolumnie tabeli Stanu serwera. Długi tekst
# łamie po słowach tak, żeby nie wychodził pod pierwszą kolumnę.
note_line() {
    local width=44 line="" word words=()
    read -ra words <<< "$1"
    for word in "${words[@]}"; do
        if [ -z "$line" ]; then
            line="$word"
        elif [ $(( ${#line} + 1 + ${#word} )) -le "$width" ]; then
            line="$line $word"
        else
            echo "$(pad "" 28) $line"
            line="$word"
        fi
    done
    if [ -n "$line" ]; then
        echo "$(pad "" 28) $line"
    fi
}

root_password_state() {
    case "$(passwd -S root 2>/dev/null | awk '{print $2}')" in
        P)  echo "ustawione" ;;
        L|NP) echo "brak" ;;
        *)  echo "nie udało się sprawdzić" ;;
    esac
}

# Hasło konta root (ustalenie 13.10.2026): przy instalacji Debiana zostawiamy je
# puste — Debian sam daje sudo. To opcja dla tych, którzy chcą mieć zapas na tryb
# awaryjny (tam Debian prosi o hasło roota).
set_root_password() {
    local intro pass1 pass2
    if [ "$(root_password_state)" = "ustawione" ]; then
        intro="Hasło konta root jest już ustawione.

Zmienić je?"
    else
        intro="Konto root nie ma hasła — tak jest dobrze na co dzień: do pracy \
administratora służy sudo i hasło Twojego konta.

Hasło roota przydaje się w trybie awaryjnym, gdy serwer nie chce się \
uruchomić — wtedy Debian prosi właśnie o nie.

Ustawić hasło konta root? Zapisz je w bezpiecznym miejscu \
(np. w menedżerze haseł) — to inne hasło niż hasło Twojego konta."
    fi
    whiptail --title "Hasło konta root" --yes-button "Ustaw" --no-button "Anuluj" \
        --yesno "$intro" 18 70 || return 0

    pass1=$(whiptail --title "Hasło konta root" \
        --passwordbox "Wpisz nowe hasło konta root:" 10 64 3>&1 1>&2 2>&3) || return 0
    pass2=$(whiptail --title "Hasło konta root" \
        --passwordbox "Wpisz to samo hasło jeszcze raz:" 10 64 3>&1 1>&2 2>&3) || return 0

    if [ -z "$pass1" ]; then
        whiptail --title "Hasło konta root" --msgbox "Hasło nie może być puste. Nic nie zmieniłem." 9 64
        return 0
    fi
    if [ "$pass1" != "$pass2" ]; then
        whiptail --title "Hasło konta root" --msgbox "Hasła się różnią. Nic nie zmieniłem — spróbuj jeszcze raz." 9 64
        return 0
    fi

    # printf to polecenie wbudowane — hasło nie pojawia się na liście procesów.
    if printf 'root:%s\n' "$pass1" | chpasswd >>"$LOG_FILE" 2>&1; then
        log "Ustawiono hasło konta root"
        whiptail --title "Hasło konta root" --msgbox "Hasło konta root ustawione." 9 64
    else
        log "Nie udało się ustawić hasła konta root"
        whiptail --title "Hasło konta root" --msgbox \
            "Nie udało się ustawić hasła (np. za proste?). Szczegóły: $LOG_FILE" 10 64
    fi
}

server_status_text() {
    local id name version state missing info saved s_ver s_date s_how line root_state
    echo "$(pad "Narzędzie if-server" 28) $(current_version)"
    echo "$(pad "Użytkownik serwera" 28) $TARGET_USER ($USER_HOME)"
    root_state="$(root_password_state)"
    echo "$(pad "Hasło konta root" 28) $root_state"
    if [ "$root_state" = "brak" ]; then
        note_line "przyda się w trybie awaryjnym — menu 4"
    fi
    echo
    echo "SKŁADNIKI"
    while IFS='|' read -r id name version state missing info; do
        saved="$(state_get "$id")"
        read -r s_ver s_date s_how <<< "$saved"
        case "$state" in
            jest)
                if [ -n "$saved" ]; then
                    line="jest — przepis $s_ver, $s_how $s_date"
                else
                    line="jest — nie zapisany w stanie"
                fi
                ;;
            niepelny) line="NIEPEŁNY" ;;
            brak)
                if [ -n "$saved" ]; then
                    line="BRAK — choć zapisany ($s_how $s_date)"
                else
                    line="brak"
                fi
                ;;
        esac
        echo "$(pad "$name" 28) $line"
        # Dopiski w osobnej linii — w jednej nie mieszczą się w oknie i łamią tabelkę.
        if [ -n "$info" ]; then
            note_line "$info"
        fi
        if [ -n "$missing" ]; then
            note_line "brakuje: $missing"
        fi
    done < <(check_all_components)
}

show_server_status() {
    local tmp
    tmp="$(mktemp /tmp/if-server-stan.XXXXXX)"
    server_status_text > "$tmp"
    whiptail --title "Stan serwera" --scrolltext --textbox "$tmp" 24 78
    rm -f "$tmp"
}

# ---------------------------------------------------------------------------
# Menu główne
# ---------------------------------------------------------------------------
main_menu() {
    local choice
    while true; do
        choice=$(whiptail --title "$TITLE — wersja $(current_version)" \
            --cancel-button "Wyjście" \
            --menu "Co chcesz zrobić?" 16 70 5 \
            "1" "Stan serwera" \
            "2" "Upgrade — zainstaluj i zaktualizuj składniki" \
            "3" "Sprawdź, czy jest nowsza wersja narzędzia" \
            "4" "Hasło konta root (na tryb awaryjny)" \
            "5" "O narzędziu" \
            3>&1 1>&2 2>&3) || return 0

        case "$choice" in
            1) show_server_status ;;
            2) run_upgrade ;;
            3) check_for_update ;;
            4) set_root_password ;;
            5) whiptail --title "O narzędziu" --msgbox \
"IF-home-server — narzędzie serwera domowego.

Zainstalowana wersja: $(current_version)
Miejsce: $APP_DIR
Stan serwera: $STATE_FILE
Dziennik: $LOG_FILE

https://github.com/if-faber/IF-home-server" 17 70 ;;
        esac
    done
}

main() {
    if [ "$(id -u)" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            exec sudo "$SELF" "$@"
        fi
        echo "BŁĄD: uruchom jako root: sudo if-server" >&2
        exit 1
    fi

    if ! : >> "$LOG_FILE" 2>/dev/null; then
        LOG_FILE="/tmp/if-server.log"
    fi

    local tool
    for tool in git whiptail; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            echo "BŁĄD: brak programu '$tool'. Zainstaluj go poleceniem:" >&2
            echo "  sudo apt install -y $tool" >&2
            exit 1
        fi
    done

    if [ ! -t 0 ] || [ ! -t 1 ]; then
        echo "BŁĄD: if-server potrzebuje terminala (np. PuTTY)." >&2
        exit 1
    fi

    # Bez tego ramki whiptail w PuTTY bywają „krzaczkowate” (jak w install-myhome.sh).
    export NCURSES_NO_UTF8_ACS=1

    if [ -z "${TARGET_USER-}" ] && ! TARGET_USER="$(detect_target_user)"; then
        echo "BŁĄD: nie udało się wykryć użytkownika serwera. Uruchom: TARGET_USER=nazwa sudo -E if-server" >&2
        exit 1
    fi
    USER_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
    export TARGET_USER USER_HOME

    # Polecenie if-server w systemie — tylko dla kopii w /opt/if-home-server,
    # kopia robocza w innym miejscu nie przejmuje polecenia.
    if [ "$APP_DIR" = "$INSTALL_DIR" ]; then
        if [ "$(readlink -f "$COMMAND_LINK" 2>/dev/null || true)" != "$SELF" ]; then
            ln -sfn "$SELF" "$COMMAND_LINK"
            log "Utworzono polecenie $COMMAND_LINK -> $SELF"
        fi
    fi

    log "=== start, wersja $(current_version), $APP_DIR, użytkownik $TARGET_USER ==="
    check_for_update quiet
    recognize_components
    main_menu
    log "=== koniec ==="
}

# Uruchomienie (a nie wczytanie funkcji, np. do testów).
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
