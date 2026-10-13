# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: podstawy systemu (install-myhome.sh, krok „sudo, curl, git, lsb-release”)
#
# Każdy składnik ustawia:
#   NAZWA   — nazwa na ekranie
#   WERSJA  — wersja przepisu instalacji (rośnie, gdy zmieniamy, co instalujemy)
# i ma funkcje:
#   sprawdz    — wypisuje brakujące elementy (po jednym w linii; linia „info: ...”
#                to dodatkowa informacja). Kod 1 = składnika nie ma wcale.
#   pytania    — (nieobowiązkowa) pyta o ustawienia przed instalacją i dopisuje
#                je do pliku "$ODPOWIEDZI" jako linie ZMIENNA=wartość (nie na
#                ekran — tam rysują się okna whiptail). Kod różny od 0 = anulowano.
#   zainstaluj — instaluje albo uzupełnia składnik (polecenia przez run/run_sh).
NAZWA="Podstawy systemu"
WERSJA=1

sprawdz() {
    pakiet_jest sudo || return 1
    brak_pakietow curl git lsb-release
}

pytania() {
    local mode
    # sudo z hasłem czy bez (decyzja 11.10.2026: domyślnie z hasłem)
    if whiptail --title "Uprawnienia administratora (sudo)" \
        --yes-button "Z hasłem (zalecane)" --no-button "Bez hasła" \
        --yesno "Czy przy poleceniach administratora (sudo) serwer ma pytać o hasło użytkownika '${TARGET_USER}'?

Z hasłem (zalecane): ktoś, kto przejmie Twoje konto, nie dostanie od razu pełnej władzy nad serwerem.

Bez hasła: wygodniej, ale przejęcie konta = przejęcie całego serwera." 16 70; then
        mode="password"
    else
        mode="nopasswd"
    fi
    printf 'SUDO_MODE=%q\n' "$mode" >> "$ODPOWIEDZI"
}

zainstaluj() {
    run "Instalacja sudo/curl/git/lsb-release" apt-get install -y sudo curl git lsb-release

    local sudoers_file="/etc/sudoers.d/${TARGET_USER}"
    local nopasswd_line="${TARGET_USER} ALL=(ALL) NOPASSWD: ALL"
    usermod -aG sudo "$TARGET_USER"
    if [ "${SUDO_MODE:-password}" = "nopasswd" ]; then
        echo "$nopasswd_line" > "$sudoers_file"
        chmod 0440 "$sudoers_file"
        if ! visudo -cf "$sudoers_file" >>"$LOG_FILE" 2>&1; then
            rm -f "$sudoers_file"
            warn "Wpis sudo bez hasła był błędny — usunięty, zostaje sudo z hasłem"
        else
            info "Dodano '${TARGET_USER}' do sudo (BEZ hasła — Twój wybór)"
        fi
    else
        # Usuwamy wpis bez hasła zostawiony wcześniej.
        if [ -f "$sudoers_file" ] && grep -qx "$nopasswd_line" "$sudoers_file"; then
            rm -f "$sudoers_file"
            info "Usunięto stary wpis sudo bez hasła"
        fi
        info "'${TARGET_USER}' w sudo (z hasłem użytkownika)"
    fi
}
