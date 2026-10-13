# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: druk i skanowanie (install-myhome.sh, krok „Pakiety systemowe”, rola drukowania)
NAZWA="Druk i skanowanie"
WERSJA=1

sprawdz() {
    if pakiet_jest cups; then
        echo "info: serwer wydruku"
    elif pakiet_jest cups-client; then
        echo "info: klient wydruku"
    else
        return 1
    fi
    brak_pakietow sane-utils
}

pytania() {
    local role
    if pakiet_jest cups; then
        role="server"
    elif pakiet_jest cups-client; then
        role="client"
    elif whiptail --title "Serwer wydruku" \
        --yes-button "Tak, serwer" --no-button "Nie, tylko klient" \
        --yesno "Czy TEN komputer ma być serwerem wydruku — czyli będzie miał podłączoną fizyczną drukarkę i udostępni ją w sieci innym urządzeniom?

Wybierz 'Nie, tylko klient', jeśli chcesz tylko móc drukować na drukarce udostępnionej przez inny komputer/serwer w sieci (tak jest w większości domów, gdzie serwer wydruku już gdzieś działa)." 16 70; then
        role="server"
    else
        role="client"
    fi
    printf 'PRINT_SERVER_ROLE=%q\n' "$role" >> "$ODPOWIEDZI"
}

zainstaluj() {
    if [ "${PRINT_SERVER_ROLE:-client}" = "server" ]; then
        run "Serwer druku (CUPS) + skanowanie" apt-get install -y cups sane-utils
        # Grupa lpadmin jest tylko przy pełnym serwerze CUPS.
        usermod -aG lpadmin "$TARGET_USER"
        info "Dodano '${TARGET_USER}' do grupy lpadmin"
    else
        run "Klient druku (CUPS) + skanowanie" apt-get install -y cups-client sane-utils
    fi
}
