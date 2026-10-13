# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: Docker (install-myhome.sh, krok „Docker”)
NAZWA="Docker"
WERSJA=1

sprawdz() {
    pakiet_jest docker-ce || return 1
    brak_pakietow docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
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
}
