# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: wykresy w Cockpit (install-myhome.sh, krok „Cockpit PCP”)
NAZWA="Wykresy w Cockpit (PCP)"
WERSJA=1

sprawdz() {
    pakiet_jest cockpit-pcp || pakiet_jest pcp || return 1
    brak_pakietow cockpit-pcp pcp python3-pcp
}

zainstaluj() {
    run "Instalacja PCP" apt-get install -y cockpit-pcp pcp python3-pcp
    # „pcp” to stary skrypt SysV bez runlevels — włączamy tylko pmcd (opis w install-myhome.sh).
    run "Włączenie pmcd" systemctl enable --now pmcd
    run "Restart Cockpit" systemctl restart cockpit
}
