# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: katalogi serwera w katalogu domowym (install-myhome.sh, krok „Struktura katalogów myhome”)
#
# Zasada dwufolderowa: pliki definicji stosów → docker/app/<usługa>/,
# dane trwałe (wolumeny/config/bazy) → docker/app-data/<usługa>/
NAZWA="Katalogi serwera"
WERSJA=1

KATALOGI=(docker/app docker/app-data documentation backups blog creativity)

sprawdz() {
    local d
    [ -d "$USER_HOME/docker/app" ] || return 1
    for d in "${KATALOGI[@]}"; do
        [ -d "$USER_HOME/$d" ] || echo "$d"
    done
}

zainstaluj() {
    local d
    for d in "${KATALOGI[@]}"; do
        mkdir -p "${USER_HOME}/${d}"
    done
    chown -R "${TARGET_USER}:${TARGET_USER}" \
        "${USER_HOME}/docker" "${USER_HOME}/documentation" "${USER_HOME}/backups" \
        "${USER_HOME}/blog" "${USER_HOME}/creativity"
    info "Katalogi: ${KATALOGI[*]}"
    warn "Duże biblioteki danych (zdjęcia, filmy) montuj poza katalogiem domowym, np. w /mnt/."
}
