# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: Cockpit i wtyczki (install-myhome.sh, krok „Cockpit i wtyczki”)
#
# Świadomie pominięte (opis w install-myhome.sh): Sensors (tylko Fahrenheity,
# CTOP pokazuje temperatury), Compose (dubluje Dockge, wymaga Node.js 22+).
NAZWA="$(t 'Cockpit i wtyczki')"
WERSJA=1

sprawdz() {
    local p
    pakiet_jest cockpit || return 1
    brak_pakietow udisks2-lvm2 udisks2-btrfs cockpit-sosreport \
        cockpit-navigator cockpit-file-sharing cockpit-identities dockermanager
    for p in explorer ctop; do
        [ -d "/usr/share/cockpit/$p" ] || printf '%s\n' "$(t 'wtyczka %s' "$p")"
    done
}

zainstaluj() {
    run "$(t 'Instalacja Cockpit')" apt-get install -y cockpit
    run "$(t 'Włączenie cockpit.socket')" systemctl enable --now cockpit.socket

    # Bez tych modułów strona „Pamięć masowa” pokazuje czerwone „Ups!” (test 11.10.2026).
    run "$(t 'Moduły dysków dla Cockpit (LVM, Btrfs)')" apt-get install -y udisks2-lvm2 udisks2-btrfs
    run "$(t 'Oficjalny dodatek: diagnostyka (sosreport)')" apt-get install -y cockpit-sosreport

    # Wtyczki 45Drives — skrypt z internetu dodaje ich repozytorium (opis w README).
    run_sh "$(t 'Repozytorium 45Drives')" "curl -sSL https://repo.45drives.com/setup | bash"
    run "$(t 'Aktualizacja listy pakietów')" apt-get update
    run "$(t 'Wtyczki 45Drives')" apt-get install -y cockpit-navigator cockpit-file-sharing cockpit-identities

    rm -rf /usr/share/cockpit/explorer
    run "$(t 'Wtyczka: Explorer')" git clone --depth 1 https://github.com/ismetozalp/explorer.git /usr/share/cockpit/explorer

    echo "deb [trusted=yes arch=all] https://chrisjbawden.github.io/cockpit-dockermanager stable main" \
        > /etc/apt/sources.list.d/cockpit-dockermanager.list
    run "$(t 'Aktualizacja listy pakietów')" apt-get update
    run "$(t 'Wtyczka: Docker Manager')" apt-get install -y dockermanager

    rm -rf /usr/share/cockpit/ctop
    run "$(t 'Wtyczka: CTOP')" git clone --depth 1 https://github.com/ismetozalp/ctop.git /usr/share/cockpit/ctop

    find /usr/share/cockpit/ -type d -name ".git" -exec rm -rf {} +
    chmod -R 755 /usr/share/cockpit/

    run "$(t 'Restart Cockpit')" systemctl restart cockpit
}
