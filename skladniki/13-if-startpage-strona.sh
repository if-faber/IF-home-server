# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: strona startowa IF-startpage — stos „if-startpage” w Dockge.
#
# Strona jest częścią tego repozytorium (folder strona/). Instalator:
#   - nie ma strony            → stawia ją (compose ze strona/compose.yaml, PIN z pytania),
#   - strona starsza niż porównawcza (IFSTARTPAGE_TAG) → zmienia wersję w jej compose i uruchamia,
#   - taka sama albo nowsza    → nic nie robi (nowsze poprawki strony instaluje się w Dockge),
#   - strona postawiona z niepodmienionym {user} w ścieżkach → po pytaniu przenosi ją na
#     właściwe miejsce (stare dane i stary stos zostają w kopii, nic nie kasujemy).
# Wersja porównawcza = najnowsza wersja strony w chwili wydania serwera (USTALENIA home-server).
NAZWA="IF-startpage (strona startowa)"
WERSJA=5

IFSTARTPAGE_TAG="v0.3.0"

ifstartpage_compose() {
    printf '%s\n' "${USER_HOME}/docker/app/if-startpage/compose.yaml"
}

ifstartpage_kontener_jest() {
    docker inspect if-startpage >/dev/null 2>&1
}

# Wersja działającej strony (z nazwy obrazu), np. v0.1.7.2; pusto, gdy nie da się odczytać.
ifstartpage_wersja() {
    docker inspect -f '{{.Config.Image}}' if-startpage 2>/dev/null | sed -n 's/.*:\(v[0-9][0-9.]*\)$/\1/p'
}

# Prawda, gdy strona jest starsza niż porównawcza.
ifstartpage_starsza() {
    local obecna
    obecna="$(ifstartpage_wersja)"
    [ -n "$obecna" ] && [ "$obecna" != "$IFSTARTPAGE_TAG" ] \
        && [ "$(printf '%s\n%s\n' "$obecna" "$IFSTARTPAGE_TAG" | sort -V | head -n 1)" = "$obecna" ]
}

# Ścieżki z dosłownym „{user}” (compose wklejony do Dockge bez podmiany nazwy użytkownika).
ifstartpage_zle_sciezki() {
    docker inspect -f '{{range .Mounts}}{{.Source}} {{end}}' if-startpage 2>/dev/null | grep -qF '{user}'
}

ifstartpage_etykieta() {
    docker inspect -f "{{index .Config.Labels \"$1\"}}" if-startpage 2>/dev/null
}

sprawdz() {
    if ! ifstartpage_kontener_jest; then
        [ -f "$(ifstartpage_compose)" ] || return 1
        echo "działający kontener if-startpage"
        return 0
    fi
    if ifstartpage_zle_sciezki; then
        echo "strona zapisuje dane w złym folderze (/home/{user}) — przeniesienie"
    fi
    if ifstartpage_starsza; then
        echo "nowa wersja strony: ${IFSTARTPAGE_TAG} (jest $(ifstartpage_wersja))"
    fi
    [ "$(docker inspect -f '{{.State.Running}}' if-startpage 2>/dev/null)" = "true" ] \
        || echo "działający kontener if-startpage"
}

pytania() {
    local pin1 pin2
    if ifstartpage_kontener_jest; then
        # Przeniesienie strony tylko za zgodą — na ekranie, przed instalacją.
        if ifstartpage_zle_sciezki; then
            whiptail --title "Strona startowa (IF-startpage)" --yes-button "Przenieś" --no-button "Anuluj" \
                --yesno "Strona startowa zapisuje dane w złym folderze:

$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/config"}}{{.Source}}{{end}}{{end}}' if-startpage 2>/dev/null)

Przenieść ją na właściwe miejsce (${USER_HOME}/docker/app-data/if-startpage)?
Strona zniknie na chwilę. Stare dane i stary stos zostaną jako kopia — nic nie kasujemy." 17 74 || return 1
        fi
        return 0
    fi
    [ -f "$(ifstartpage_compose)" ] && return 0
    while true; do
        pin1=$(whiptail --title "Strona startowa (IF-startpage)" \
            --passwordbox "Ustaw PIN do Zaplecza strony startowej (4–8 cyfr).

Strona startowa to panel serwera w przeglądarce: http://<adres-serwera>
PIN chroni ustawienia i zmiany. Później zmienisz go w Zapleczu → Ustawienia ogólne." \
            14 70 3>&1 1>&2 2>&3) || return 1
        pin2=$(whiptail --title "Strona startowa (IF-startpage)" \
            --passwordbox "Wpisz PIN jeszcze raz, żeby go potwierdzić." \
            10 70 3>&1 1>&2 2>&3) || return 1
        if [[ "$pin1" =~ ^[0-9]{4,8}$ ]] && [ "$pin1" = "$pin2" ]; then
            break
        fi
        whiptail --title "Strona startowa (IF-startpage)" \
            --msgbox "PIN musi mieć 4–8 cyfr i oba wpisy muszą być takie same — spróbuj ponownie." 8 70
    done
    printf 'IFSTARTPAGE_PIN=%q\n' "$pin1" >> "$ODPOWIEDZI"
}

# Przenosi stronę z błędnymi ścieżkami: zatrzymuje ją, kopiuje dane, stary stos odkłada do ~/backups.
ifstartpage_przenies() {
    local stary_compose stary_folder stare_dane d stamp
    stary_compose="$(ifstartpage_etykieta com.docker.compose.project.config_files)"
    stary_folder="$(ifstartpage_etykieta com.docker.compose.project.working_dir)"
    stare_dane="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/config"}}{{.Source}}{{end}}{{end}}' if-startpage)"
    stare_dane="$(dirname "$stare_dane")"
    IFSTARTPAGE_PIN="$(sed -n 's/.*DASHBOARD_PIN=\([0-9][0-9]*\).*/\1/p' "$stary_compose" 2>/dev/null | head -n 1)"
    stamp="$(date +%Y%m%d-%H%M)"

    info "Przenoszę stronę z ${stare_dane}"
    run "Zatrzymanie strony startowej" docker compose -f "$stary_compose" down
    for d in config backups icons; do
        mkdir -p "${data}/${d}"
        if [ -d "${stare_dane}/${d}" ] && [ -z "$(ls -A "${data}/${d}")" ]; then
            cp -a "${stare_dane}/${d}/." "${data}/${d}/"
        fi
    done
    info "Dane strony skopiowane do ${data}"
    mkdir -p "${USER_HOME}/backups"
    if [ "$stary_folder" != "$dir" ] && [ -d "$stary_folder" ]; then
        mv "$stary_folder" "${USER_HOME}/backups/stos-$(basename "$stary_folder")-przed-przeniesieniem-${stamp}"
        info "Stary stos odłożony do ${USER_HOME}/backups/stos-$(basename "$stary_folder")-przed-przeniesieniem-${stamp}"
    elif [ -f "$compose" ]; then
        mv "$compose" "${USER_HOME}/backups/if-startpage-compose-przed-przeniesieniem-${stamp}.yaml"
    fi
    info "Stare dane zostały w ${stare_dane} — po sprawdzeniu strony można je usunąć"
}

zainstaluj() {
    local compose dir data stary
    compose="$(ifstartpage_compose)"
    dir="$(dirname "$compose")"
    data="${USER_HOME}/docker/app-data/if-startpage"

    if ifstartpage_kontener_jest && ifstartpage_zle_sciezki; then
        ifstartpage_przenies
    fi

    if ifstartpage_kontener_jest; then
        # Strona jest (także postawiona wcześniej w innym miejscu): tylko wersja, gdy starsza.
        if ifstartpage_starsza; then
            stary="$(ifstartpage_etykieta com.docker.compose.project.config_files)"
            info "Strona startowa: $(ifstartpage_wersja) → ${IFSTARTPAGE_TAG}"
            sed -i "s#\(image: *ghcr.io/if-faber/if-startpage:\)v[0-9.]*#\1${IFSTARTPAGE_TAG}#" "$stary"
            run "Aktualizacja strony startowej" docker compose -f "$stary" up -d
        else
            info "Strona startowa $(ifstartpage_wersja) — aktualna, zostawiam bez zmian"
        fi
    else
        if [ ! -f "$compose" ]; then
            if ss -ltnH 'sport = :80' 2>/dev/null | grep -q .; then
                warn "Port 80 jest zajęty przez inny program — strony startowej nie instaluję"
                return 1
            fi
            mkdir -p "$dir"
            sed -e "s#/home/{user}#${USER_HOME}#g" \
                -e "s#{user}#${TARGET_USER}#g" \
                -e "s#DASHBOARD_PIN=[0-9]*#DASHBOARD_PIN=${IFSTARTPAGE_PIN:-1234}#" \
                -e "s#\(image: *ghcr.io/if-faber/if-startpage:\)v[0-9.]*#\1${IFSTARTPAGE_TAG}#" \
                "$APP_DIR/strona/compose.yaml" > "$compose"
            chmod 600 "$compose"
            info "Utworzono compose.yaml dla strony startowej ${IFSTARTPAGE_TAG}"
        fi
        mkdir -p "${data}/config" "${data}/backups" "${data}/icons"
        chown -R "${TARGET_USER}:${TARGET_USER}" "$dir" "$data"
        run "Uruchomienie strony startowej" docker compose -f "$compose" up -d
    fi

    # Lista aktualizacji Debiana i wersja serwera od razu (zadanie z „Narzędzi dla IF-startpage”).
    if systemctl cat if-system-updates.service >/dev/null 2>&1; then
        run "Lista aktualizacji Debiana dla strony" systemctl start --no-block if-system-updates.service
    fi
    info "Strona startowa: http://<adres-serwera>"
}
