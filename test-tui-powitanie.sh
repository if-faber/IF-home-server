#!/usr/bin/env bash
#
# test-tui-powitanie.sh
# Samodzielny skrypt testowy — sprawdza ekran powitalny TUI (whiptail)
# w sesji PuTTY, zanim wepniemy go do install-myhome.sh.
#
# PRZED URUCHOMIENIEM sprawdź w PuTTY (Window > Translation):
#   - Remote character set: UTF-8
#   - Handling of line drawing characters: "Use Unicode line drawing code points"
#     (jeśli tej opcji nie ma w Twojej wersji PuTTY — sam UTF-8 charset zwykle wystarcza)
#   - Zostaw Terminal-type string jako "xterm" (Connection > Data) — NIE zmieniaj na "putty",
#     chyba że masz pewność że pakiet ncurses-term z wpisem terminfo "putty" jest
#     zainstalowany na serwerze — inaczej whiptail może się wywalić błędem nieznanego terminala.
#   - Font z pełnym Unicode (np. Consolas, Cascadia Mono, DejaVu Sans Mono)
#
# Uruchom na serwerze: chmod +x test-tui-powitanie.sh && ./test-tui-powitanie.sh

set -euo pipefail

# Naprawia krzaczki na liniach ramki w PuTTY (konflikt ACS/UTF-8 w ncurses)
export NCURSES_NO_UTF8_ACS=1

echo "== Test TUI powitania przez PuTTY =="
echo

# 1. Sprawdzenie locale (informacyjnie — whiptail/ncurses potrzebuje aktywnego
#    locale UTF-8, żeby poprawnie wyświetlić polskie znaki: ą ć ę ł ń ó ś ź ż)
echo "Aktualne locale:"
locale | grep -E '^(LANG|LC_ALL|LC_CTYPE)=' || true
if ! locale 2>/dev/null | grep -qi 'utf-8'; then
    echo
    echo "UWAGA: nie widać aktywnego locale UTF-8. Polskie znaki mogą się źle wyświetlać."
    echo "Sprawdź: sudo dpkg-reconfigure locales (i wybierz np. pl_PL.UTF-8 lub en_US.UTF-8)"
    echo
fi

# 2. Sprawdzenie / instalacja whiptail
if ! command -v whiptail >/dev/null 2>&1; then
    echo "whiptail nie jest zainstalowany — instaluję..."
    sudo apt update -qq && sudo apt install -y whiptail
fi

# 3. Ekran powitalny
WELCOME_MSG="Witaj w instalatorze aplikacji systemowych dla domowego serwera.

Pomożemy Ci zainstalować niezbędne oprogramowanie do poprawnego \
funkcjonowania serwera, w przyjazny sposób.

Nie przerywaj raz rozpoczętego procesu instalacji — może to \
spowodować uszkodzenie instalacji i późniejsze problemy.

W trakcie instalacji możesz zostać poproszony o wpisanie danych \
niezbędnych do instalacji (np. haseł) — nie odchodź od komputera, \
aby móc je uzupełnić.

Gotowy?"

if whiptail --title "Instalator serwera domowego" \
    --yes-button "Tak, zaczynamy" --no-button "Anuluj" \
    --yesno "$WELCOME_MSG" 20 70; then
    whiptail --title "Instalator serwera domowego" --msgbox "Ruszamy i powodzenia!" 8 50
    echo
    echo "OK — zaakceptowano. Sprawdź wizualnie czy dialogi wyrenderowały się poprawnie."
else
    echo
    echo "Anulowano (to też jest wynik testu — sprawdź czy przycisk \"Anuluj\" zadziałał poprawnie)."
fi

echo
echo "== Koniec testu =="
echo "Daj znać: (1) czy ramki/linie wyglądały poprawnie (bez krzaczków),"
echo "          (2) czy polskie znaki (ą ć ę ł ń ó ś ź ż) wyświetliły się poprawnie,"
echo "          (3) czy rozmiar okna (20 70 / 8 50) pasował do treści bez ucinania."
