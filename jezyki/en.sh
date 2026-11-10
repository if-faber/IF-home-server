# shellcheck shell=bash disable=SC2034  # T czyta if-server.sh
# English texts for if-server and its components (skladniki/*.sh).
# Klucz — polski tekst dokładnie jak w kodzie (z \n i %s), wartość — tłumaczenie
# z tymi samymi %s / %d w tej samej kolejności. Sprawdzenie: python3 jezyki/sprawdz.py en

# --- if-server.sh: aktualizacja narzędzia ---
T['Nie udało się sprawdzić, czy jest nowsza wersja.\n\nSprawdź połączenie z internetem. Szczegóły: %s']='Could not check for a newer version.\n\nCheck your internet connection. Details: %s'
T['Masz najnowszą wersję: %s']='You have the latest version: %s'
T['Jest nowsza wersja (%s), ale nie udało się jej pobrać.\n\nSzczegóły: %s']='A newer version (%s) is available, but it could not be downloaded.\n\nDetails: %s'
T['Co nowego — %s']='What is new — %s'
T['Opis tej wersji jest tylko po polsku.']='Release notes for this version are available in Polish only.'
T['Aktualizuj']='Update'
T['Zostań na obecnej']='Keep current'
T['Jest nowsza wersja narzędzia.\n\nZainstalowana: %s\nDostępna:      %s\n\nZaktualizować teraz?']='A newer version of the tool is available.\n\nInstalled: %s\nAvailable: %s\n\nUpdate now?'
T['Aktualizacja nie powiodła się — zostaje obecna wersja.\n\nSzczegóły: %s']='The update failed — the current version stays.\n\nDetails: %s'
T['Zaktualizowano do wersji %s.\n\nUruchamiam nową wersję.']='Updated to version %s.\n\nStarting the new version.'

# --- if-server.sh: instalacja i Upgrade ---
T['BŁĄD']='ERROR'
T['nowy']='new'
T['niepełny, brakuje: %s']='incomplete, missing: %s'
T['niepełny (braki: Stan serwera)']='incomplete (see Server status)'
T['nowy przepis %s → %s']='new recipe %s → %s'
T['Wszystkie składniki są zainstalowane i aktualne.']='All components are installed and up to date.'
T['Zaznaczone składniki zostaną zainstalowane albo uzupełnione.\nSpacja — zaznacz / odznacz, Enter — dalej.']='Selected components will be installed or completed.\nSpace — select / deselect, Enter — continue.'
T['Anulowano — nic nie zostało zainstalowane.']='Cancelled — nothing was installed.'
T['Instaluj']='Install'
T['Anuluj']='Cancel'
T['Do zainstalowania:\n\n%s\n\nZaczynamy?']='To be installed:\n\n%s\n\nStart now?'
T['Upgrade: %d składn.']='Upgrade: %d component(s)'
T['Aktualizacja listy pakietów']='Updating the package list'
T['lista pakietów']='package list'
T['Gotowe: zainstalowano %d z %d.']='Done: installed %d of %d.'
T['Przerwano na: %s. Zainstalowano %d z %d.']='Stopped at: %s. Installed %d of %d.'
T['Szczegóły w dzienniku: %s']='Details in the log: %s'
T['Zalecany restart serwera: sudo reboot']='Restart of the server recommended: sudo reboot'
T['Naciśnij Enter, aby wrócić do menu... ']='Press Enter to return to the menu... '
T['Rozpoznałem składniki, które już są na tym serwerze (liczba: %d).

Zapisałem je w stanie serwera — nic nie zostało zainstalowane ani zmienione.

Szczegóły: menu → Stan serwera.']='I found components that are already on this server (count: %d).

I saved them in the server state — nothing was installed or changed.

Details: menu → Server status.'

# --- if-server.sh: hasło konta root ---
T['Hasło konta root jest już ustawione.

Zmienić je?']='The root account password is already set.

Change it?'
T['Konto root nie ma hasła — tak jest dobrze na co dzień: do pracy administratora służy sudo i hasło Twojego konta.

Hasło roota przydaje się w trybie awaryjnym, gdy serwer nie chce się uruchomić — wtedy Debian prosi właśnie o nie.

Ustawić hasło konta root? Zapisz je w bezpiecznym miejscu (np. w menedżerze haseł) — to inne hasło niż hasło Twojego konta.']='The root account has no password — that is fine for everyday use: administration is done with sudo and the password of your own account.

The root password is useful in emergency mode, when the server does not start — that is when Debian asks for it.

Set a root account password? Keep it in a safe place (e.g. a password manager) — it is a different password than the one for your account.'
T['Hasło konta root']='Root account password'
T['Ustaw']='Set'
T['Wpisz nowe hasło konta root:']='Enter the new root account password:'
T['Wpisz to samo hasło jeszcze raz:']='Enter the same password again:'
T['Hasło nie może być puste. Nic nie zmieniłem.']='The password cannot be empty. Nothing was changed.'
T['Hasła się różnią. Nic nie zmieniłem — spróbuj jeszcze raz.']='The passwords do not match. Nothing was changed — try again.'
T['Hasło konta root ustawione.']='Root account password set.'
T['Nie udało się ustawić hasła (np. za proste?). Szczegóły: %s']='Could not set the password (too simple?). Details: %s'
T['haslo|ustawione']='set'
T['haslo|brak']='not set'
T['haslo|nie udało się sprawdzić']='could not check'

# --- if-server.sh: Stan serwera ---
T['Narzędzie if-server']='if-server tool'
T['Użytkownik serwera']='Server user'
T['przyda się w trybie awaryjnym — menu 4']='useful in emergency mode — menu 4'
T['SKŁADNIKI']='COMPONENTS'
T['jest — przepis %s, %s %s']='present — recipe %s, %s %s'
T['jest — nie zapisany w stanie']='present — not in the state file'
T['NIEPEŁNY']='INCOMPLETE'
T['BRAK — choć zapisany (%s %s)']='MISSING — though recorded (%s %s)'
T['brak']='not installed'
T['brakuje: %s']='missing: %s'
T['zainstalowany']='installed'
T['rozpoznany']='recognized'
T['Stan serwera']='Server status'

# --- if-server.sh: menu ---
T['wersja %s']='version %s'
T['Wyjście']='Exit'
T['Co chcesz zrobić?']='What do you want to do?'
T['Upgrade — zainstaluj i zaktualizuj składniki']='Upgrade — install and update components'
T['Sprawdź, czy jest nowsza wersja narzędzia']='Check for a newer version of the tool'
T['Hasło konta root (na tryb awaryjny)']='Root account password (for emergency mode)'
T['O narzędziu']='About'
T['IF-home-server — narzędzie serwera domowego.

Zainstalowana wersja: %s
Miejsce: %s
Stan serwera: %s
Dziennik: %s
Język: %s (zmiana: menu → Język / Language)

https://github.com/if-faber/IF-home-server']='IF-home-server — the home server tool.

Installed version: %s
Location: %s
Server state: %s
Log: %s
Language: %s (change: menu → Język / Language)

https://github.com/if-faber/IF-home-server'

# --- if-server.sh: błędy przy starcie ---
T["BŁĄD: brak programu '%s'. Zainstaluj go poleceniem:"]="ERROR: program '%s' is missing. Install it with:"
T['BŁĄD: if-server potrzebuje terminala (np. PuTTY).']='ERROR: if-server needs a terminal (e.g. PuTTY).'
T['BŁĄD: nie udało się wykryć użytkownika serwera. Uruchom: TARGET_USER=nazwa sudo -E if-server']='ERROR: could not detect the server user. Run: TARGET_USER=name sudo -E if-server'


# --- skladniki/01-podstawy.sh ---
T['Podstawy systemu']='System basics'
T['serwer nie zasypia (uśpienie i hibernacja wyłączone)']='server does not sleep (sleep and hibernation off)'
T['Uprawnienia administratora (sudo)']='Administrator rights (sudo)'
T['Z hasłem (zalecane)']='With password'
T['Bez hasła']='No password'
T["Czy przy poleceniach administratora (sudo) serwer ma pytać o hasło użytkownika '%s'?

Z hasłem (zalecane): ktoś, kto przejmie Twoje konto, nie dostanie od razu pełnej władzy nad serwerem.

Bez hasła: wygodniej, ale przejęcie konta = przejęcie całego serwera."]="Should the server ask for the password of user '%s' for administrator commands (sudo)?

With password (recommended): someone who takes over your account does not get full control of the server right away.

No password: more convenient, but taking over the account = taking over the whole server."
T['Instalacja sudo/curl/git/lsb-release']='Installing sudo/curl/git/lsb-release'
T['Wpis sudo bez hasła był błędny — usunięty, zostaje sudo z hasłem']='The passwordless sudo entry was invalid — removed, sudo with password stays'
T["Dodano '%s' do sudo (BEZ hasła — Twój wybór)"]="Added '%s' to sudo (WITHOUT password — your choice)"
T['Usunięto stary wpis sudo bez hasła']='Removed the old passwordless sudo entry'
T["'%s' w sudo (z hasłem użytkownika)"]="'%s' in sudo (with the user password)"
T['Wyłączenie uśpienia i hibernacji']='Turning off sleep and hibernation'
T['Ustawienia klapy i bezczynności zadziałają po najbliższym ponownym uruchomieniu']='Lid and idle settings take effect after the next restart'

# --- skladniki/02-cichy-start.sh ---
T['Cichy start']='Quiet boot'
T['ustawienia GRUB']='GRUB settings'
T['Aktualizacja GRUB-a']='Updating GRUB'
T['Zastosowanie sysctl']='Applying sysctl'

# --- skladniki/03-pakiety.sh ---
T['Python / Node.js']='Python / Node.js'
T['Pakiety systemowe']='System packages'
T['SSH i mDNS (.local)']='SSH and mDNS (.local)'
T['Diagnostyka sprzętu (smartmontools, lm-sensors...)']='Hardware diagnostics (smartmontools, lm-sensors...)'
T['Protokoły sieciowe (NFS/CIFS)']='Network protocols (NFS/CIFS)'

# --- skladniki/04-druk.sh ---
T['Druk i skanowanie']='Printing and scanning'
T['serwer wydruku']='print server'
T['klient wydruku']='print client'
T['Serwer wydruku']='Print server'
T['Tak, serwer']='Yes, server'
T['Nie, tylko klient']='No, client only'
T["Czy TEN komputer ma być serwerem wydruku — czyli będzie miał podłączoną fizyczną drukarkę i udostępni ją w sieci innym urządzeniom?

Wybierz 'Nie, tylko klient', jeśli chcesz tylko móc drukować na drukarce udostępnionej przez inny komputer/serwer w sieci (tak jest w większości domów, gdzie serwer wydruku już gdzieś działa)."]="Should THIS computer be a print server — that is, have a printer physically connected and share it with other devices on the network?

Choose 'No, client only' if you only want to print on a printer shared by another computer/server on the network (that is the case in most homes, where a print server already runs somewhere)."
T['Serwer druku (CUPS) + skanowanie']='Print server (CUPS) + scanning'
T["Dodano '%s' do grupy lpadmin"]="Added '%s' to the lpadmin group"
T['Klient druku (CUPS) + skanowanie']='Print client (CUPS) + scanning'

# --- skladniki/05-docker.sh ---
T['Klucz GPG Dockera']='Docker GPG key'
T['stałe DNS dla aplikacji (daemon.json)']='fixed DNS for apps (daemon.json)'
T['DNS dla aplikacji już jest w %s']='DNS for apps is already in %s'
T['Nie znalazłem serwerów DNS od routera w /etc/resolv.conf — pomijam (aplikacje użyją ustawień Dockera)']='No DNS servers from the router found in /etc/resolv.conf — skipping (apps will use Docker settings)'
T['%s już istnieje (inne ustawienia) — nie nadpisuję. Dopisz w nim: "dns": %s']='%s already exists (other settings) — not overwriting. Add to it: "dns": %s'
T['DNS dla aplikacji: %s']='DNS for apps: %s'
T['Ponowne uruchomienie Dockera — aplikacje znikną na kilkanaście sekund']='Restarting Docker — apps will be gone for a dozen or so seconds'
T['Ponowne uruchomienie Dockera']='Restarting Docker'
T['Zależności (ca-certificates, gnupg...)']='Dependencies (ca-certificates, gnupg...)'
T['Instalacja silnika Docker']='Installing the Docker engine'
T["Dodano '%s' do grupy docker"]="Added '%s' to the docker group"

# --- skladniki/06-katalogi.sh ---
T['Katalogi serwera']='Server folders'
T['Katalogi: %s']='Folders: %s'
T['Duże biblioteki danych (zdjęcia, filmy) montuj poza katalogiem domowym, np. w /mnt/.']='Mount large data libraries (photos, movies) outside the home folder, e.g. in /mnt/.'

# --- skladniki/07-dockge.sh ---
T['działający kontener dockge']='running dockge container'
T['Utworzono docker-compose.yml dla Dockge']='Created docker-compose.yml for Dockge'
T['docker-compose.yml dla Dockge już jest — zostawiam bez zmian']='docker-compose.yml for Dockge already exists — leaving it unchanged'
T['Uruchomienie Dockge']='Starting Dockge'
T['Dockge: http://<adres-serwera>:5001']='Dockge: http://<server-address>:5001'

# --- skladniki/08-samba.sh ---
T['Udostępnianie plików w sieci (Samba)']='File sharing on the network (Samba)'
T["Ustaw hasło do udostępniania plików w sieci dla użytkownika '%s'.

Będzie ono potrzebne na innych komputerach/urządzeniach w domu, żeby połączyć się z udostępnionymi folderami.

Program, który to obsługuje, nazywa się Samba — to standardowy sposób udostępniania folderów w sieci domowej (w Windows widoczny w Eksploratorze w zakładce Sieć)."]="Set the network file sharing password for user '%s'.

You will need it on other computers/devices at home to connect to the shared folders.

The program that handles this is called Samba — the standard way to share folders on a home network (in Windows visible in File Explorer under Network)."
T['Wpisz hasło jeszcze raz, żeby je potwierdzić.']='Enter the password again to confirm it.'
T['Hasła się różnią albo pole było puste — spróbuj ponownie.']='The passwords do not match or the field was empty — try again.'
T['Instalacja Samby']='Installing Samba'
T['Włączenie usług smbd/nmbd']='Enabling smbd/nmbd services'
T['Hasło Samby ustawione']='Samba password set'
T['Nie udało się ustawić hasła Samby (szczegóły w dzienniku)']='Could not set the Samba password (details in the log)'

# --- skladniki/09-cockpit.sh ---
T['Repozytorium 45Drives']='45Drives repository'
T['Cockpit i wtyczki']='Cockpit and plugins'
T['wtyczka %s']='plugin %s'
T['Instalacja Cockpit']='Installing Cockpit'
T['Włączenie cockpit.socket']='Enabling cockpit.socket'
T['Moduły dysków dla Cockpit (LVM, Btrfs)']='Disk modules for Cockpit (LVM, Btrfs)'
T['Oficjalny dodatek: diagnostyka (sosreport)']='Official add-on: diagnostics (sosreport)'
T['Wtyczki 45Drives']='45Drives plugins'
T['Wtyczka: Explorer']='Plugin: Explorer'
T['Wtyczka: Docker Manager']='Plugin: Docker Manager'
T['Wtyczka: CTOP']='Plugin: CTOP'
T['Restart Cockpit']='Restarting Cockpit'

# --- skladniki/10-pcp.sh ---
T['Wykresy w Cockpit (PCP)']='Charts in Cockpit (PCP)'
T['Instalacja PCP']='Installing PCP'
T['Włączenie pmcd']='Enabling pmcd'

# --- skladniki/11-uslugi.sh ---
T['Wyłączenie zbędnych usług']='Unneeded services off'
T['wyłączenie %s']='turning off %s'
T['Wyłączenie %s']='Turning off %s'

# --- skladniki/12-if-startpage.sh ---
T['Narzędzia dla IF-startpage']='Tools for IF-startpage'
T['skrypt if-system-updates']='if-system-updates script'
T['zadanie if-system-updates.timer']='if-system-updates.timer task'
T['odświeżanie listy po aktualizacji (apt)']='refreshing the list after updates (apt)'
T['Sprawdzanie skryptów (shellcheck)']='Script checking (shellcheck)'
T['if-system-updates.service już jest — zostawiam bez zmian']='if-system-updates.service already exists — leaving it unchanged'
T['Przeładowanie systemd']='Reloading systemd'
T['Sprawdzanie aktualizacji raz dziennie (if-system-updates.timer)']='Checking for updates once a day (if-system-updates.timer)'
T['Lista aktualizacji Debiana dla strony']='Debian update list for the start page'
T['Lista aktualizacji trafi do: %s/docker/app-data/if-startpage/config/system-updates.json']='The update list goes to: %s/docker/app-data/if-startpage/config/system-updates.json'

# --- skladniki/13-if-startpage-strona.sh ---
T['IF-startpage (strona startowa)']='IF-startpage (start page)'
T['działający kontener if-startpage']='running if-startpage container'
T['strona zapisuje dane w złym folderze (/home/{user}) — przeniesienie']='the page saves data in the wrong folder (/home/{user}) — moving'
T['nowa wersja strony: %s (jest %s)']='new page version: %s (installed %s)'
T['Strona startowa (IF-startpage)']='Start page (IF-startpage)'
T['Przenieś']='Move'
T['Strona startowa zapisuje dane w złym folderze:

%s

Przenieść ją na właściwe miejsce (%s/docker/app-data/if-startpage)?
Strona zniknie na chwilę. Stare dane i stary stos zostaną jako kopia — nic nie kasujemy.']='The start page saves data in the wrong folder:

%s

Move it to the right place (%s/docker/app-data/if-startpage)?
The page will be gone for a moment. The old data and the old stack stay as a copy — nothing is deleted.'
T['Ustaw PIN do Zaplecza strony startowej (4–8 cyfr).

Strona startowa to panel serwera w przeglądarce: http://<adres-serwera>
PIN chroni ustawienia i zmiany. Później zmienisz go w Zapleczu → Ustawienia ogólne.']='Set a PIN for the start page Admin panel, 4–8 digits.

The start page is the server panel in your browser: http://<server-address>
The PIN protects settings and changes. You can change it later in Admin panel → General settings.'
T['Wpisz PIN jeszcze raz, żeby go potwierdzić.']='Enter the PIN again to confirm it.'
T['PIN musi mieć 4–8 cyfr i oba wpisy muszą być takie same — spróbuj ponownie.']='The PIN must have 4–8 digits and both entries must match — try again.'
T['Przenoszę stronę z %s']='Moving the page from %s'
T['Zatrzymanie strony startowej']='Stopping the start page'
T['Dane strony skopiowane do %s']='Page data copied to %s'
T['Stary stos odłożony do %s/backups/stos-%s-przed-przeniesieniem-%s']='Old stack put aside in %s/backups/stos-%s-przed-przeniesieniem-%s'
T['Stare dane zostały w %s — po sprawdzeniu strony można je usunąć']='The old data stayed in %s — you can delete it after checking the page'
T['Strona startowa: %s → %s']='Start page: %s → %s'
T['Aktualizacja strony startowej']='Updating the start page'
T['Strona startowa %s — aktualna, zostawiam bez zmian']='Start page %s — up to date, leaving it unchanged'
T['Port 80 jest zajęty przez inny program — strony startowej nie instaluję']='Port 80 is used by another program — not installing the start page'
T['Utworzono compose.yaml dla strony startowej %s']='Created compose.yaml for start page %s'
T['Uruchomienie strony startowej']='Starting the start page'
T['Strona startowa: http://%s (albo http://<adres IP serwera>)']='Start page: http://%s (or http://<server IP address>)'

# --- skladniki/14-kopia-zapasowa.sh ---
T['Kopia zapasowa']='Backup'
T['skrypt if-backup']='if-backup script'
T['zadanie if-backup.path']='if-backup.path task'
T['harmonogram kopii (if-backup-harmonogram.timer)']='backup schedule (if-backup-harmonogram.timer)'
T['Python (dla zadania kopii)']='Python (for the backup task)'
T['%s już jest — zostawiam bez zmian']='%s already exists — leaving it unchanged'
T['Kopia zapasowa: czekanie na zlecenia ze strony (if-backup.path)']='Backup: waiting for requests from the page (if-backup.path)'
T['Kopia zapasowa: harmonogram (if-backup-harmonogram.timer)']='Backup: schedule (if-backup-harmonogram.timer)'
T['Ustawienia kopii: strona startowa → Zaplecze → Kopia zapasowa']='Backup settings: start page → Admin panel → Backup'

# --- skladniki/15-instalator-aplikacji.sh ---
T['Instalator aplikacji']='App installer'
T['skrypt if-aplikacje']='if-aplikacje script'
T['zadanie if-aplikacje.path']='if-aplikacje.path task'
T['Python (dla Instalatora aplikacji)']='Python (for the App installer)'
T['Instalator aplikacji: czekanie na zlecenia ze strony (if-aplikacje.path)']='App installer: waiting for requests from the page (if-aplikacje.path)'
T['Instalator: strona startowa → Zaplecze → Aplikacje → Instalator']='Installer: start page → Admin panel → Apps → Installer'
