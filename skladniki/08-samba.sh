# shellcheck shell=bash disable=SC2034  # NAZWA i WERSJA czyta if-server.sh
# Składnik: Samba (install-myhome.sh, krok „Samba”)
NAZWA="Samba"
WERSJA=1

sprawdz() {
    pakiet_jest samba || return 1
    brak_pakietow samba-common-bin
}

pytania() {
    local pass1 pass2
    # Uzupełnienie istniejącej Samby — hasło już jest, nie pytamy.
    if pakiet_jest samba && pdbedit -L 2>/dev/null | awk -F: -v u="$TARGET_USER" '$1 == u {f = 1} END {exit !f}'; then
        return 0
    fi
    while true; do
        pass1=$(whiptail --title "Udostępnianie plików w sieci (Samba)" \
            --passwordbox "Ustaw hasło do udostępniania plików w sieci dla użytkownika '${TARGET_USER}'.

Będzie ono potrzebne na innych komputerach/urządzeniach w domu, żeby połączyć się z udostępnionymi folderami.

Program, który to obsługuje, nazywa się Samba — to standardowy sposób udostępniania folderów w sieci domowej (w Windows widoczny w Eksploratorze w zakładce Sieć)." \
            16 70 3>&1 1>&2 2>&3) || return 1
        pass2=$(whiptail --title "Udostępnianie plików w sieci (Samba)" \
            --passwordbox "Wpisz hasło jeszcze raz, żeby je potwierdzić." \
            10 70 3>&1 1>&2 2>&3) || return 1
        if [ -n "$pass1" ] && [ "$pass1" = "$pass2" ]; then
            break
        fi
        whiptail --title "Udostępnianie plików w sieci (Samba)" \
            --msgbox "Hasła się różnią albo pole było puste — spróbuj ponownie." 8 60
    done
    printf 'SMB_PASSWORD=%q\n' "$pass1" >> "$ODPOWIEDZI"
}

zainstaluj() {
    run "Instalacja Samby" apt-get install -y samba samba-common-bin
    run "Włączenie usług smbd/nmbd" systemctl enable --now smbd nmbd

    if [ -n "${SMB_PASSWORD-}" ]; then
        # printf to polecenie wbudowane — hasło nie pojawia się na liście procesów.
        if printf '%s\n%s\n' "$SMB_PASSWORD" "$SMB_PASSWORD" | smbpasswd -a -s "$TARGET_USER" >>"$LOG_FILE" 2>&1; then
            info "Hasło Samby ustawione"
        else
            warn "Nie udało się ustawić hasła Samby (szczegóły w dzienniku)"
            return 1
        fi
        unset SMB_PASSWORD
    fi
}
