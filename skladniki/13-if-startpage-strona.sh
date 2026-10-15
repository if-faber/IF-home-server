# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: IF-startpage — strona startowa serwera, jako stos w Dockge.
#
# compose.yaml pobieramy z GitHuba w konkretnej, sprawdzonej wersji (nigdy „latest”),
# wpisujemy ścieżki użytkownika i PIN. Kolejne wersje strony instaluje się już z jej
# Zaplecza (Aktualizacje) i w Dockge. Istniejącego compose.yaml nie nadpisujemy.
NAZWA="IF-startpage (strona startowa)"
WERSJA=1

IFSTARTPAGE_TAG="v0.1.7.1"
IFSTARTPAGE_COMPOSE_URL="https://raw.githubusercontent.com/if-faber/if-startpage/${IFSTARTPAGE_TAG}/compose.yaml"

ifstartpage_compose() {
    printf '%s\n' "${USER_HOME}/docker/app/if-startpage/compose.yaml"
}

sprawdz() {
    [ -f "$(ifstartpage_compose)" ] || return 1
    [ "$(docker inspect -f '{{.State.Running}}' if-startpage 2>/dev/null)" = "true" ] \
        || echo "działający kontener if-startpage"
}

pytania() {
    local pin1 pin2
    # Strona już jest — PIN zmienia się w jej Zapleczu, nie pytamy.
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

zainstaluj() {
    local compose dir data tmp
    compose="$(ifstartpage_compose)"
    dir="$(dirname "$compose")"
    data="${USER_HOME}/docker/app-data/if-startpage"

    if [ ! -f "$compose" ]; then
        # Port 80 zajęty przez coś innego — nie uruchomimy strony obok.
        if ss -ltnH 'sport = :80' 2>/dev/null | grep -q .; then
            warn "Port 80 jest zajęty przez inny program — strony startowej nie instaluję"
            return 1
        fi
        tmp="$(mktemp)"
        run "Pobranie compose.yaml IF-startpage ${IFSTARTPAGE_TAG}" \
            curl -fsSL "$IFSTARTPAGE_COMPOSE_URL" -o "$tmp"
        grep -q "if-startpage:${IFSTARTPAGE_TAG}" "$tmp" || { rm -f "$tmp"; warn "Pobrany compose.yaml nie ma wersji ${IFSTARTPAGE_TAG}"; return 1; }
        mkdir -p "$dir"
        sed -e "s#/home/{user}#${USER_HOME}#g" \
            -e "s#{user}#${TARGET_USER}#g" \
            -e "s#DASHBOARD_PIN=[0-9]*#DASHBOARD_PIN=${IFSTARTPAGE_PIN:-1234}#" \
            "$tmp" > "$compose"
        rm -f "$tmp"
        chmod 600 "$compose"
        info "Utworzono compose.yaml dla IF-startpage ${IFSTARTPAGE_TAG}"
    else
        # Plik mógł być zmieniony w Dockge (np. nowsza wersja) — nie nadpisujemy.
        info "compose.yaml IF-startpage już jest — zostawiam bez zmian"
    fi

    mkdir -p "${data}/config" "${data}/backups" "${data}/icons"
    chown -R "${TARGET_USER}:${TARGET_USER}" "$dir" "$data"
    run "Uruchomienie IF-startpage" docker compose -f "$compose" up -d
    info "Strona startowa: http://<adres-serwera> (Zaplecze — PIN z instalacji)"
}
