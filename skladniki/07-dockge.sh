# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: Dockge (install-myhome.sh, krok „Dockge”)
#
# Ścieżka stosów w kontenerze musi być taka sama jak na serwerze (1:1) —
# inaczej ścieżki względne w compose.yaml stosów trafiają w złe miejsce
# (https://github.com/louislam/dockge/discussions/146).
NAZWA="Dockge"
WERSJA=1

sprawdz() {
    [ -f "$USER_HOME/docker/app/dockge/docker-compose.yml" ] || return 1
    [ "$(docker inspect -f '{{.State.Running}}' dockge 2>/dev/null)" = "true" ] \
        || echo "działający kontener dockge"
}

zainstaluj() {
    local compose="${USER_HOME}/docker/app/dockge/docker-compose.yml"
    mkdir -p "${USER_HOME}/docker/app/dockge" "${USER_HOME}/docker/app-data/dockge"

    if [ ! -f "$compose" ]; then
        printf '%s\n' \
            'services:' \
            '  dockge:' \
            '    image: louislam/dockge:1.5.0' \
            '    container_name: dockge' \
            '    restart: unless-stopped' \
            '    ports:' \
            '      - "5001:5001"' \
            '    volumes:' \
            '      - /var/run/docker.sock:/var/run/docker.sock' \
            "      - ${USER_HOME}/docker/app-data/dockge:/app/data" \
            "      - ${USER_HOME}/docker/app:${USER_HOME}/docker/app" \
            '    environment:' \
            "      - DOCKGE_STACKS_DIR=${USER_HOME}/docker/app" \
            > "$compose"
        info "Utworzono docker-compose.yml dla Dockge"
    else
        # Plik mógł być edytowany w Dockge — nie nadpisujemy.
        info "docker-compose.yml dla Dockge już jest — zostawiam bez zmian"
    fi

    chown -R "${TARGET_USER}:${TARGET_USER}" "${USER_HOME}/docker"
    run "Uruchomienie Dockge" docker compose -f "$compose" up -d
    info "Dockge: http://<adres-serwera>:5001"
}
