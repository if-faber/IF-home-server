# IF-home-server

Program do instalacji i opieki nad domowym serwerem na Debianie 13: **`sudo if-server`**.
Część pakietu **IdeaForge** — zobacz też [IF-startpage](https://github.com/if-faber/IF-startpage).

Od wersji 0.2.0 to już nie jednorazowy plik instalacyjny, tylko **program, który zostaje
na serwerze** (podobnie jak KIAUH dla Klippera).

## Funkcje

- **Stan serwera** — każdy składnik: jest / niepełny (czego brakuje) / brak.
- **Upgrade** — instaluje nowe składniki, uzupełnia niepełne, aktualizuje te, których
  przepis się zmienił. Na czystym Debianie to pełna instalacja.
- **Aktualizacja programu** — przy starcie sprawdza nowszą wersję, pokazuje „Co nowego”,
  pyta: aktualizuj / zostań na obecnej.
- **Rozpoznanie istniejącej instalacji** — serwer postawiony starym skryptem
  (`install-myhome.sh`) jest rozpoznawany bez instalowania czegokolwiek od nowa.
- **Hasło konta root** — opcjonalnie, na tryb awaryjny (przy instalacji Debiana
  hasło roota zostawiamy puste — Debian sam daje wtedy `sudo`).

## Instalowane aplikacje (składniki)

| Składnik | Co zawiera |
|---|---|
| Podstawy systemu | sudo, curl, git, lsb-release |
| Cichy start | wyciszony rozruch (GRUB) i logi jądra |
| Pakiety systemowe | SSH, avahi (`.local`), smartmontools, lm-sensors, sysstat, htop, cifs-utils, nfs-common, Node.js, Python (pip, venv) |
| Druk i skanowanie | CUPS (serwer albo klient), sane-utils |
| Docker | Docker z oficjalnego repozytorium, Docker Compose |
| Katalogi serwera | `~/docker/app`, `~/docker/app-data` i foldery robocze |
| Dockge | menedżer stosów Docker Compose (port 5001) |
| Samba | udostępnianie plików w sieci domowej |
| Cockpit i wtyczki | panel serwera (port 9090), moduły dysków, sosreport, 45Drives (Navigator, File Sharing, Identities), Explorer, Docker Manager, CTOP |
| Wykresy w Cockpit | PCP — historia obciążenia |
| Wyłączenie zbędnych usług | colord, nfs-blkmap |
| Narzędzia dla IF-startpage | ShellCheck, lista aktualizacji Debiana dla strony startowej (codziennie i od razu po każdej aktualizacji) |

Wtyczki 45Drives i Docker Manager pochodzą spoza repozytoriów Debiana (45Drives — skrypt
`curl | bash` z uprawnieniami roota, Docker Manager — repozytorium bez sprawdzania podpisu).

## Instalacja

Debian 13 (netinst) z „SSH server”, hasło roota puste, najlepiej na kablu sieciowym. Potem:

```sh
sudo apt install -y git
sudo git clone https://github.com/if-faber/IF-home-server.git /opt/if-home-server
sudo /opt/if-home-server/if-server.sh
```

W menu: **Upgrade**. Później wystarczy `sudo if-server`.

## Testy (wersja 0.2.0)

| Test | Sprzęt | Wynik |
|---|---|---|
| Czysta instalacja Debiana 13 i Upgrade wszystkich składników | HP t730 Thin Client | 12 z 12, Cockpit i Dockge działają po restarcie |
| Serwer zainstalowany starym skryptem: rozpoznanie i uzupełnienie | HP t730 Thin Client | rozpoznane 10 składników, uzupełnione 2 |
| Rozpoznanie, aktualizacje programu, hasło roota | Fujitsu Esprimo Q920 | bez błędów |

## Licencja

MIT — zobacz [LICENSE](LICENSE).
