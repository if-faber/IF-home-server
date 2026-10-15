# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: IF-startpage — strona startowa serwera, jako stos w Dockge.
#
# compose.yaml pobieramy z GitHuba w konkretnej, sprawdzonej wersji (nigdy „latest”),
# wpisujemy ścieżki użytkownika i PIN. Kolejne wersje strony instaluje się już z jej
# Zaplecza (Aktualizacje) i w Dockge. Istniejącego compose.yaml nie nadpisujemy.
NAZWA="IF-startpage (strona startowa)"
# WERSJA 2: strona v0.1.7.2 i od razu lista aktualizacji Debiana (wcześniej zadanie z listą
# pomijało zapis, bo folder strony powstawał dopiero tutaj — lista była dopiero w nocy).
# WERSJA 3: strona rozpoznawana po kontenerze if-startpage — także postawiona wcześniej ręcznie
# w Dockge (inny folder lub nazwa pliku compose); wtedy niczego nie instalujemy.
WERSJA=3

IFSTARTPAGE_TAG="v0.1.7.2"
IFSTARTPAGE_COMPOSE_URL="https://raw.githubusercontent.com/if-faber/if-startpage/${IFSTARTPAGE_TAG}/compose.yaml"

ifstartpage_compose() {
    printf '%s\n' "${USER_HOME}/docker/app/if-startpage/compose.yaml"
}

# Kontener if-startpage już jest (niezależnie od tego, skąd go postawiono).
ifstartpage_kontener_jest() {
    docker inspect if-startpage >/dev/null 2>&1
}

sprawdz() {
    if ifstartpage_kontener_jest && [ ! -f "$(ifstartpage_compose)" ]; then
        [ "$(docker inspect -f '{{.State.Running}}' if-startpage 2>/dev/null)" = "true" ] \
            || echo "działający kontener if-startpage"
        return 0
    fi
    [ -f "$(ifstartpage_compose)" ] || return 1
    [ "$(docker inspect -f '{{.State.Running}}' if-startpage 2>/dev/null)" = "true" ] \
        || echo "działający kontener if-startpage"
}

pytania() {
    local pin1 pin2
    # Strona już jest — PIN zmienia się w jej Zapleczu, nie pytamy.
    [ -f "$(ifstartpage_compose)" ] && return 0
    ifstartpage_kontener_jest && return 0
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

    # Strona postawiona wcześniej ręcznie (w innym miejscu) — zostawiamy ją, tylko lista Debiana.
    if [ ! -f "$compose" ] && ifstartpage_kontener_jest; then
        info "Strona startowa już działa (stos: $(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' if-startpage 2>/dev/null)) — zostawiam bez zmian"
        if systemctl cat if-system-updates.service >/dev/null 2>&1; then
            run "Lista aktualizacji Debiana dla strony" systemctl start --no-block if-system-updates.service
        fi
        return 0
    fi

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
    # Lista aktualizacji Debiana od razu (zadanie z „Narzędzi dla IF-startpage”, jeśli jest).
    if systemctl cat if-system-updates.service >/dev/null 2>&1; then
        run "Lista aktualizacji Debiana dla strony" systemctl start --no-block if-system-updates.service
    fi
    info "Strona startowa: http://<adres-serwera> (Zaplecze — PIN z instalacji)"
}
