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
NAZWA="$(t 'Podstawy systemu')"
# WERSJA 2: serwer nigdy sam nie zasypia (uśpienie i hibernacja wyłączone, zamknięcie
# klapy laptopa nic nie robi) — 15.10.2026 testowy serwer zahibernował się w trakcie instalacji.
WERSJA=2

LOGIND_IF=/etc/systemd/logind.conf.d/if-server.conf

sprawdz() {
    pakiet_jest sudo || return 1
    brak_pakietow curl git lsb-release
    [ "$(systemctl is-enabled sleep.target 2>/dev/null)" = "masked" ] && [ -f "$LOGIND_IF" ] \
        || printf '%s\n' "$(t 'serwer nie zasypia (uśpienie i hibernacja wyłączone)')"
}

pytania() {
    local mode
    # sudo z hasłem czy bez (decyzja 11.10.2026: domyślnie z hasłem)
    if whiptail --title "$(t 'Uprawnienia administratora (sudo)')" \
        --yes-button "$(t 'Z hasłem (zalecane)')" --no-button "$(t 'Bez hasła')" \
        --yesno "$(t "Czy przy poleceniach administratora (sudo) serwer ma pytać o hasło użytkownika '%s'?

Z hasłem (zalecane): ktoś, kto przejmie Twoje konto, nie dostanie od razu pełnej władzy nad serwerem.

Bez hasła: wygodniej, ale przejęcie konta = przejęcie całego serwera." "${TARGET_USER}")" 16 70; then
        mode="password"
    else
        mode="nopasswd"
    fi
    printf 'SUDO_MODE=%q\n' "$mode" >> "$ODPOWIEDZI"
}

zainstaluj() {
    run "$(t 'Instalacja sudo/curl/git/lsb-release')" apt-get install -y sudo curl git lsb-release

    local sudoers_file="/etc/sudoers.d/${TARGET_USER}"
    local nopasswd_line="${TARGET_USER} ALL=(ALL) NOPASSWD: ALL"
    usermod -aG sudo "$TARGET_USER"
    if [ "${SUDO_MODE:-password}" = "nopasswd" ]; then
        echo "$nopasswd_line" > "$sudoers_file"
        chmod 0440 "$sudoers_file"
        if ! visudo -cf "$sudoers_file" >>"$LOG_FILE" 2>&1; then
            rm -f "$sudoers_file"
            warn "$(t 'Wpis sudo bez hasła był błędny — usunięty, zostaje sudo z hasłem')"
        else
            info "$(t "Dodano '%s' do sudo (BEZ hasła — Twój wybór)" "${TARGET_USER}")"
        fi
    else
        # Usuwamy wpis bez hasła zostawiony wcześniej.
        if [ -f "$sudoers_file" ] && grep -qx "$nopasswd_line" "$sudoers_file"; then
            rm -f "$sudoers_file"
            info "$(t 'Usunięto stary wpis sudo bez hasła')"
        fi
        info "$(t "'%s' w sudo (z hasłem użytkownika)" "${TARGET_USER}")"
    fi

    # Serwer ma działać cały czas: bez uśpienia i hibernacji (także po zamknięciu klapy).
    run "$(t 'Wyłączenie uśpienia i hibernacji')" \
        systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
    install -m 0755 -d "$(dirname "$LOGIND_IF")"
    printf '%s\n' "# if-server: serwer nie zasypia (klapa laptopa, bezczynność)" "[Login]" \
        "HandleLidSwitch=ignore" "HandleLidSwitchExternalPower=ignore" "HandleLidSwitchDocked=ignore" \
        "HandleSuspendKey=ignore" "HandleHibernateKey=ignore" "IdleAction=ignore" > "$LOGIND_IF"
    chmod 644 "$LOGIND_IF"
    info "$(t 'Ustawienia klapy i bezczynności zadziałają po najbliższym ponownym uruchomieniu')"
}
