# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: Docker (install-myhome.sh, krok „Docker”)
#
# WERSJA 2: stałe serwery DNS dla aplikacji w /etc/docker/daemon.json. Bez tego po restarcie
# serwera Docker potrafi uruchomić aplikacje, zanim serwer dostanie adresy DNS od routera —
# aplikacje działają w sieci domowej, ale nie widzą internetu (IF-startpage: „nieznana” wersja).
NAZWA="Docker"
WERSJA=2

DOCKER_DAEMON_JSON=/etc/docker/daemon.json

# Serwery DNS, które serwer dostał od routera (z /etc/resolv.conf), bez adresów lokalnych
# (127.x, ::1) — tych z wnętrza kontenera nie da się użyć. Najwyżej trzy, po jednym w linii.
dns_z_routera() {
    awk '$1 == "nameserver" && $2 !~ /^127\./ && $2 != "::1" && $2 !~ /%/ { print $2 }' /etc/resolv.conf 2>/dev/null \
        | head -n 3
}

sprawdz() {
    pakiet_jest docker-ce || return 1
    brak_pakietow docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    grep -qs '"dns"' "$DOCKER_DAEMON_JSON" || echo "stałe DNS dla aplikacji (daemon.json)"
}

# Wpisuje DNS do daemon.json i uruchamia Dockera ponownie. Istniejącego pliku bez DNS
# nie nadpisuje (mogą tam być inne ustawienia) — podaje, co dopisać.
ustaw_dns_dockera() {
    local adresy lista adres
    if grep -qs '"dns"' "$DOCKER_DAEMON_JSON"; then
        info "DNS dla aplikacji już jest w ${DOCKER_DAEMON_JSON}"
        return 0
    fi
    adresy="$(dns_z_routera)"
    if [ -z "$adresy" ]; then
        warn "Nie znalazłem serwerów DNS od routera w /etc/resolv.conf — pomijam (aplikacje użyją ustawień Dockera)"
        return 0
    fi
    lista=""
    while IFS= read -r adres; do
        lista="${lista}\"${adres}\", "
    done <<< "$adresy"
    lista="[${lista%, }]"
    if [ -f "$DOCKER_DAEMON_JSON" ]; then
        warn "${DOCKER_DAEMON_JSON} już istnieje (inne ustawienia) — nie nadpisuję. Dopisz w nim: \"dns\": ${lista}"
        return 0
    fi
    install -m 0755 -d /etc/docker
    printf '{ "dns": %s }\n' "$lista" > "$DOCKER_DAEMON_JSON"
    chmod 644 "$DOCKER_DAEMON_JSON"
    info "DNS dla aplikacji: ${lista}"
    warn "Ponowne uruchomienie Dockera — aplikacje znikną na kilkanaście sekund"
    run "Ponowne uruchomienie Dockera" systemctl restart docker
}

zainstaluj() {
    run "Zależności (ca-certificates, gnupg...)" apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings

    if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
        run_sh "Klucz GPG Dockera" \
            "curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
    fi
    chmod a+r /etc/apt/keyrings/docker.gpg

    # shellcheck disable=SC1091  # /etc/os-release jest dopiero na serwerze
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list

    run "Aktualizacja listy pakietów" apt-get update
    run "Instalacja silnika Docker" apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    usermod -aG docker "$TARGET_USER"
    info "Dodano '${TARGET_USER}' do grupy docker"

    ustaw_dns_dockera
}
