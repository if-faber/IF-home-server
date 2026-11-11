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
LANGS_DIR="$APP_DIR/jezyki"
LANG_FILE="$STATE_DIR/jezyk"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"
}

# ---------------------------------------------------------------------------
# Języki (od v0.5.0): polski tekst w kodzie jest kluczem, tłumaczenia leżą
# w jezyki/<kod>.sh jako T['polski tekst']='tłumaczenie'. Brak tłumaczenia →
# polski tekst. Język wybiera się raz — na pierwszym ekranie (English / Polski)
# albo poleceniem sudo if-server --en / --pl — i jest zapamiętany w $LANG_FILE.
# Zmiana później: menu → Język / Language. Dziennik zostaje po polsku.
# ---------------------------------------------------------------------------
declare -A T=()
IF_LANG="pl"

# t 'tekst z %s' wartość... — tekst w wybranym języku z wstawionymi wartościami
# (jak printf: %s — wartość, %d — liczba, %% — znak procentu).
# t -k kontekst 'tekst' — gdy to samo polskie słowo ma po angielsku dwa znaczenia
# (np. „brak” hasła i „brak” składnika): najpierw T['kontekst|tekst'], potem T['tekst'].
t() {
    local ctx=""
    if [ "${1-}" = "-k" ]; then
        ctx="$2"; shift 2
    fi
    local text="$1"; shift
    if [ -n "$ctx" ] && [ -n "${T[$ctx|$text]+x}" ]; then
        text="${T[$ctx|$text]}"
    elif [ -n "${T[$text]+x}" ]; then
        text="${T[$text]}"
    fi
    # shellcheck disable=SC2059  # tekst jest wzorem printf
    printf -- "$text" "$@"
}

# Ekran wyboru języka — w obu językach, bo jeszcze nie wiadomo, który rozumie czytający.
# Wypisuje kod języka; przerwanie (Esc / Wyjście) — kod 1.
choose_language() {
    local current="${1:-en}"
    whiptail --title "IF-home-server" \
        --ok-button "OK" --cancel-button "Exit / Wyjście" \
        --default-item "$current" \
        --menu "Choose the installer language:\nWybierz język instalatora:" 12 60 2 \
        "en" "English" \
        "pl" "Polski" \
        3>&1 1>&2 2>&3
}

save_language() {
    mkdir -p "$STATE_DIR"
    echo "$1" > "$LANG_FILE"
}

# load_language [--en|--pl] — wybór z polecenia zapisuje, bez niego czyta zapisany.
# Nic nie zapisane: serwer już zainstalowany (jest plik stanu, przed v0.5.0 wszystkie
# po polsku) — polski bez pytania; nowy serwer — ekran wyboru języka.
load_language() {
    local arg chosen=""
    for arg in "$@"; do
        case "$arg" in
            --en) chosen="en" ;;
            --pl) chosen="pl" ;;
        esac
    done
    if [ -n "$chosen" ]; then
        IF_LANG="$chosen"
        save_language "$chosen"
    elif [ -f "$LANG_FILE" ]; then
        # shellcheck disable=SC2018  # kod języka: tylko a–z
        IF_LANG="$(tr -dc 'a-z' < "$LANG_FILE")"
    elif [ -f "$STATE_FILE" ]; then
        IF_LANG="pl"
        save_language pl
    else
        chosen="$(choose_language)" || exit 0
        IF_LANG="$chosen"
        save_language "$chosen"
    fi
    [ -n "$IF_LANG" ] || IF_LANG="pl"
    if [ "$IF_LANG" != "pl" ] && [ -f "$LANGS_DIR/$IF_LANG.sh" ]; then
        # shellcheck disable=SC1090
        source "$LANGS_DIR/$IF_LANG.sh"
        # Przyciski, których nie podajemy sami (np. „Cancel” w whiptail), też w tym języku.
        export LANGUAGE="$IF_LANG"
    fi
    export IF_LANG
}

# ---------------------------------------------------------------------------
# Wersje narzędzia
# ---------------------------------------------------------------------------
repo_git() {
    git -C "$APP_DIR" "$@"
}

# Wersja zapisana w pliku WERSJA (vX.Y.Z). Tagi wydań leżą na osobnych commitach
# wydania (GitHub), więc kopia z Gitei (np. gałąź testowa) nie ma tagu w historii —
# bez tego pliku uważałaby się za v0.0.0 i proponowała „aktualizację” do starszego
# wydania. Przy wydaniu WERSJA = numer tagu.
file_version() {
    local v=""
    if [ -f "$APP_DIR/WERSJA" ]; then
        v="$(tr -d '[:space:]' < "$APP_DIR/WERSJA")"
    fi
    if [[ "$v" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "$v"
    fi
}

# Wersja do porównań: nowsza z najbliższego tagu i pliku WERSJA.
current_base_version() {
    local tag file
    tag="$(repo_git describe --tags --match 'v[0-9]*' --abbrev=0 2>/dev/null || echo "v0.0.0")"
    file="$(file_version)"
    if [ -n "$file" ] && version_gt "$file" "$tag"; then
        echo "$file"
    else
        echo "$tag"
    fi
}

# Obecna wersja do wyświetlenia: tag vX.Y.Z wskazujący dokładnie na HEAD (wydanie),
# a dla kopii roboczej wersja + skrót commita, np. v0.5.0+8b6dda0.
current_version() {
    local exact
    if exact="$(repo_git describe --tags --match 'v[0-9]*' --exact-match 2>/dev/null)"; then
        echo "$exact"
    else
        echo "$(current_base_version)+$(repo_git rev-parse --short HEAD 2>/dev/null || echo "?")"
    fi
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
            # Od v0.5.0 opis ma dwie części rozdzielone linią „--- en ---”:
            # polską i angielską. Starsze opisy (bez tej linii) są tylko po polsku —
            # w innym języku zamiast polskiego tekstu krótka informacja.
            repo_git tag -l --format='%(contents)' "$tag" \
                | awk -v lang="$IF_LANG" -v only_pl="$(t 'Opis tej wersji jest tylko po polsku.')" '
                    /^--- en ---$/ { split_seen = 1; next }
                    { lines[++n] = $0; part[n] = split_seen }
                    END {
                        if (lang != "pl" && !split_seen) { print only_pl; print ""; exit }
                        want = (lang == "en" && split_seen) ? 1 : 0
                        for (i = 1; i <= n; i++) if (!split_seen || part[i] == want) print lines[i]
                    }'
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
                "$(t 'Nie udało się sprawdzić, czy jest nowsza wersja.\n\nSprawdź połączenie z internetem. Szczegóły: %s' "$LOG_FILE")" 12 64
        fi
        return 0
    fi
    latest="${versions[-1]}"

    if ! version_gt "$latest" "$base"; then
        log "Brak nowszej wersji (najnowsza: $latest)"
        if [ -z "$quiet" ]; then
            whiptail --title "$TITLE" --msgbox \
                "$(t 'Masz najnowszą wersję: %s' "$(current_version)")" 10 60
        fi
        return 0
    fi

    # Pobranie opisów nowych wersji (nie zmienia zainstalowanych plików).
    if ! repo_git fetch --quiet --tags origin >>"$LOG_FILE" 2>&1; then
        log "Nie udało się pobrać nowych wersji"
        whiptail --title "$TITLE" --msgbox \
            "$(t 'Jest nowsza wersja (%s), ale nie udało się jej pobrać.\n\nSzczegóły: %s' "$latest" "$LOG_FILE")" 12 64
        return 0
    fi

    local reversed=() i
    for (( i=${#versions[@]}-1; i>=0; i-- )); do
        reversed+=("${versions[i]}")
    done
    whats_new "$base" "${reversed[@]}" > "/tmp/if-server-co-nowego.txt"
    whiptail --title "$(t 'Co nowego — %s' "$latest")" --scrolltext \
        --textbox "/tmp/if-server-co-nowego.txt" 22 76
    rm -f "/tmp/if-server-co-nowego.txt"

    if ! whiptail --title "$TITLE" \
        --yes-button "$(t 'Aktualizuj')" --no-button "$(t 'Zostań na obecnej')" \
        --yesno "$(t 'Jest nowsza wersja narzędzia.\n\nZainstalowana: %s\nDostępna:      %s\n\nZaktualizować teraz?' "$(current_version)" "$latest")" 14 64; then
        log "Użytkownik został na obecnej wersji"
        return 0
    fi

    if ! repo_git -c advice.detachedHead=false checkout --quiet "$latest" >>"$LOG_FILE" 2>&1; then
        log "Aktualizacja do $latest nie powiodła się"
        whiptail --title "$TITLE" --msgbox \
            "$(t 'Aktualizacja nie powiodła się — zostaje obecna wersja.\n\nSzczegóły: %s' "$LOG_FILE")" 12 64
        return 0
    fi

    log "Zaktualizowano do $latest"
    whiptail --title "$TITLE" --msgbox \
        "$(t 'Zaktualizowano do wersji %s.\n\nUruchamiam nową wersję.' "$latest")" 10 60
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
# apt-get czeka do APT_LOCK_TIMEOUT s na zwolnienie blokady dpkg, zamiast od razu zwracać błąd —
# w tle mogą pracować inne apt (lista aktualizacji dla strony, automatyczne aktualizacje Debiana).
# Przypadek: if-media 11.11.2026, „Nie udało się uzyskać blokady /var/lib/dpkg/lock-frontend”.
APT_LOCK_TIMEOUT=300
run() {
    local desc="$1"; shift
    if [ "${1-}" = "apt-get" ]; then
        shift
        set -- apt-get -o "DPkg::Lock::Timeout=$APT_LOCK_TIMEOUT" "$@"
    fi
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
        printf "\r  %s... %s%s%s \n" "$desc" "$RED" "$(t 'BŁĄD')" "$RESET"
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
            brak)     reason="$(t 'nowy')" ;;
            niepelny)
                # Na liście Upgrade mieści się ok. 40 znaków opisu; pełna lista braków
                # jest w Stanie serwera.
                if [ "${#missing}" -le 30 ]; then
                    reason="$(t 'niepełny, brakuje: %s' "$missing")"
                else
                    reason="$(t 'niepełny (braki: Stan serwera)')"
                fi
                ;;
            jest)
                if [ -n "$s_ver" ] && [ "$s_ver" -lt "$version" ]; then
                    reason="$(t 'nowy przepis %s → %s' "$s_ver" "$version")"
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
        whiptail --title "Upgrade" --msgbox "$(t 'Wszystkie składniki są zainstalowane i aktualne.')" 9 60
        return 0
    fi

    for line in "${lines[@]}"; do
        IFS='|' read -r file id name reason <<< "$line"
        args+=("$id" "$name — $reason" ON)
    done
    # --notags: na liście tylko opisy, bez technicznych nazw składników.
    chosen=$(whiptail --title "Upgrade" --notags --checklist \
        "$(t 'Zaznaczone składniki zostaną zainstalowane albo uzupełnione.\nSpacja — zaznacz / odznacz, Enter — dalej.')" \
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
            whiptail --title "Upgrade" --msgbox "$(t 'Anulowano — nic nie zostało zainstalowane.')" 9 60
            return 0
        fi
    done

    if ! whiptail --title "Upgrade" --yes-button "$(t 'Instaluj')" --no-button "$(t 'Anuluj')" \
        --yesno "$(t 'Do zainstalowania:\n\n%s\n\nZaczynamy?' "$(printf ' - %s\n' "${names[@]}")")" 22 70; then
        rm -f "$answers"
        return 0
    fi

    clear
    printf "%s%s=== %s ===%s\n" "$CYAN" "$BOLD" "$(t 'Upgrade: %d składn.' "${#files[@]}")" "$RESET"
    log "Upgrade: ${selected[*]}"
    export DEBIAN_FRONTEND=noninteractive
    if ! run "$(t 'Aktualizacja listy pakietów')" apt-get update; then
        failed="$(t 'lista pakietów')"
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
        printf "%s%s%s%s\n" "$GREEN" "$BOLD" "$(t 'Gotowe: zainstalowano %d z %d.' "$done_count" "${#files[@]}")" "$RESET"
    else
        printf "%s%s%s%s\n" "$RED" "$BOLD" "$(t 'Przerwano na: %s. Zainstalowano %d z %d.' "$failed" "$done_count" "${#files[@]}")" "$RESET"
        echo "  $(t 'Szczegóły w dzienniku: %s' "$LOG_FILE")"
    fi
    if [ "$reboot" -eq 1 ]; then
        warn "$(t 'Zalecany restart serwera: sudo reboot')"
    fi
    echo
    read -rp "$(t 'Naciśnij Enter, aby wrócić do menu... ')" _
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
"$(t 'Rozpoznałem składniki, które już są na tym serwerze (liczba: %d).

Zapisałem je w stanie serwera — nic nie zostało zainstalowane ani zmienione.

Szczegóły: menu → Stan serwera.' "${#found[@]}")" 14 70
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
        intro="$(t 'Hasło konta root jest już ustawione.

Zmienić je?')"
    else
        intro="$(t 'Konto root nie ma hasła — tak jest dobrze na co dzień: do pracy administratora służy sudo i hasło Twojego konta.

Hasło roota przydaje się w trybie awaryjnym, gdy serwer nie chce się uruchomić — wtedy Debian prosi właśnie o nie.

Ustawić hasło konta root? Zapisz je w bezpiecznym miejscu (np. w menedżerze haseł) — to inne hasło niż hasło Twojego konta.')"
    fi
    whiptail --title "$(t 'Hasło konta root')" --yes-button "$(t 'Ustaw')" --no-button "$(t 'Anuluj')" \
        --yesno "$intro" 18 70 || return 0

    pass1=$(whiptail --title "$(t 'Hasło konta root')" \
        --passwordbox "$(t 'Wpisz nowe hasło konta root:')" 10 64 3>&1 1>&2 2>&3) || return 0
    pass2=$(whiptail --title "$(t 'Hasło konta root')" \
        --passwordbox "$(t 'Wpisz to samo hasło jeszcze raz:')" 10 64 3>&1 1>&2 2>&3) || return 0

    if [ -z "$pass1" ]; then
        whiptail --title "$(t 'Hasło konta root')" --msgbox "$(t 'Hasło nie może być puste. Nic nie zmieniłem.')" 9 64
        return 0
    fi
    if [ "$pass1" != "$pass2" ]; then
        whiptail --title "$(t 'Hasło konta root')" --msgbox "$(t 'Hasła się różnią. Nic nie zmieniłem — spróbuj jeszcze raz.')" 9 64
        return 0
    fi

    # printf to polecenie wbudowane — hasło nie pojawia się na liście procesów.
    if printf 'root:%s\n' "$pass1" | chpasswd >>"$LOG_FILE" 2>&1; then
        log "Ustawiono hasło konta root"
        whiptail --title "$(t 'Hasło konta root')" --msgbox "$(t 'Hasło konta root ustawione.')" 9 64
    else
        log "Nie udało się ustawić hasła konta root"
        whiptail --title "$(t 'Hasło konta root')" --msgbox \
            "$(t 'Nie udało się ustawić hasła (np. za proste?). Szczegóły: %s' "$LOG_FILE")" 10 64
    fi
}

server_status_text() {
    local id name version state missing info saved s_ver s_date s_how line root_state
    echo "$(pad "$(t 'Narzędzie if-server')" 28) $(current_version)"
    echo "$(pad "$(t 'Użytkownik serwera')" 28) $TARGET_USER ($USER_HOME)"
    root_state="$(root_password_state)"
    echo "$(pad "$(t 'Hasło konta root')" 28) $(t -k haslo "$root_state")"
    if [ "$root_state" = "brak" ]; then
        note_line "$(t 'przyda się w trybie awaryjnym — menu 4')"
    fi
    echo
    t 'SKŁADNIKI'
    echo
    while IFS='|' read -r id name version state missing info; do
        saved="$(state_get "$id")"
        read -r s_ver s_date s_how <<< "$saved"
        case "$state" in
            jest)
                if [ -n "$saved" ]; then
                    line="$(t 'jest — przepis %s, %s %s' "$s_ver" "$(t "$s_how")" "$s_date")"
                else
                    line="$(t 'jest — nie zapisany w stanie')"
                fi
                ;;
            niepelny) line="$(t 'NIEPEŁNY')" ;;
            brak)
                if [ -n "$saved" ]; then
                    line="$(t 'BRAK — choć zapisany (%s %s)' "$(t "$s_how")" "$s_date")"
                else
                    line="$(t 'brak')"
                fi
                ;;
        esac
        echo "$(pad "$name" 28) $line"
        # Dopiski w osobnej linii — w jednej nie mieszczą się w oknie i łamią tabelkę.
        if [ -n "$info" ]; then
            note_line "$info"
        fi
        if [ -n "$missing" ]; then
            note_line "$(t 'brakuje: %s' "$missing")"
        fi
    done < <(check_all_components)
}

show_server_status() {
    local tmp height max
    tmp="$(mktemp /tmp/if-server-stan.XXXXXX)"
    server_status_text > "$tmp"
    # Okno tak wysokie, żeby cała lista była widać bez przewijania (wcześniej stałe 24 linie
    # ucinały ostatnie składniki); najwyżej wysokość terminala.
    height=$(( $(wc -l < "$tmp") + 8 ))
    max=$(( $(tput lines 2>/dev/null || echo 24) - 1 ))
    [ "$max" -ge 24 ] || max=24
    [ "$height" -le "$max" ] || height="$max"
    [ "$height" -ge 24 ] || height=24
    whiptail --title "$(t 'Stan serwera')" --scrolltext --textbox "$tmp" "$height" 78
    rm -f "$tmp"
}

# ---------------------------------------------------------------------------
# Menu główne
# ---------------------------------------------------------------------------
main_menu() {
    local choice lang
    while true; do
        choice=$(whiptail --title "$TITLE — $(t 'wersja %s' "$(current_version)")" \
            --cancel-button "$(t 'Wyjście')" \
            --menu "$(t 'Co chcesz zrobić?')" 17 70 6 \
            "1" "$(t 'Stan serwera')" \
            "2" "$(t 'Upgrade — zainstaluj i zaktualizuj składniki')" \
            "3" "$(t 'Sprawdź, czy jest nowsza wersja narzędzia')" \
            "4" "$(t 'Hasło konta root (na tryb awaryjny)')" \
            "5" "$(t 'O narzędziu')" \
            "6" "Język / Language" \
            3>&1 1>&2 2>&3) || return 0

        case "$choice" in
            1) show_server_status ;;
            2) run_upgrade ;;
            3) check_for_update ;;
            4) set_root_password ;;
            5) whiptail --title "$(t 'O narzędziu')" --msgbox \
"$(t 'IF-home-server — narzędzie serwera domowego.

Zainstalowana wersja: %s
Miejsce: %s
Stan serwera: %s
Dziennik: %s
Język: %s (zmiana: menu → Język / Language)

https://github.com/if-faber/IF-home-server' "$(current_version)" "$APP_DIR" "$STATE_FILE" "$LOG_FILE" "$IF_LANG")" 18 70 ;;
            6)
                if lang="$(choose_language "$IF_LANG")" && [ "$lang" != "$IF_LANG" ]; then
                    save_language "$lang"
                    log "Zmiana języka na $lang"
                    exec "$SELF"
                fi
                ;;
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
            { t "BŁĄD: brak programu '%s'. Zainstaluj go poleceniem:" "$tool"; echo; } >&2
            echo "  sudo apt install -y $tool" >&2
            exit 1
        fi
    done

    if [ ! -t 0 ] || [ ! -t 1 ]; then
        { t 'BŁĄD: if-server potrzebuje terminala (np. PuTTY).'; echo; } >&2
        exit 1
    fi

    # Bez tego ramki whiptail w PuTTY bywają „krzaczkowate” (jak w install-myhome.sh).
    export NCURSES_NO_UTF8_ACS=1

    load_language "$@"

    if [ -z "${TARGET_USER-}" ] && ! TARGET_USER="$(detect_target_user)"; then
        { t 'BŁĄD: nie udało się wykryć użytkownika serwera. Uruchom: TARGET_USER=nazwa sudo -E if-server'; echo; } >&2
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

    log "=== start, wersja $(current_version), $APP_DIR, użytkownik $TARGET_USER, język $IF_LANG ==="
    check_for_update quiet
    recognize_components
    main_menu
    log "=== koniec ==="
}

# Uruchomienie (a nie wczytanie funkcji, np. do testów).
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
