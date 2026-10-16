# IF-home-server

Domowy serwer na Debianie 13 dla osób nietechnicznych: **program serwera `if-server`,
Dockge i strona startowa IF-startpage — jedna całość, instalowana razem i poprawnie.**
Część pakietu **IdeaForge**.

- `if-server` — program, który zostaje na serwerze (`sudo if-server`): instaluje, uzupełnia
  i aktualizuje wszystkie składniki (podobnie jak KIAUH dla Klippera).
- [`strona/`](strona/) — strona startowa serwera w przeglądarce (`http://<adres-serwera>`),
  z Zapleczem (PIN), stanem serwera, alertami i aktualizacjami.

**Wersje (od 0.3.0):** druga cyfra jest wspólna dla serwera i strony (0.3, 0.4…). Drobne
poprawki samej strony mają trzecią cyfrę (strona v0.3.1, v0.3.2…) i instaluje się je w Dockge.

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
| IF-startpage (strona startowa) | panel serwera w przeglądarce (`http://<adres-serwera>`), stos `if-startpage` w Dockge; przy Upgrade aktualizuje stronę starszą niż wydana z serwerem |

Wtyczki 45Drives i Docker Manager pochodzą spoza repozytoriów Debiana (45Drives — skrypt
`curl | bash` z uprawnieniami roota, Docker Manager — repozytorium bez sprawdzania podpisu).

## Instalacja

Debian 13 (netinst) z „SSH server”, hasło roota puste, najlepiej na kablu sieciowym. Potem:

```sh
sudo apt install -y git
sudo git clone https://github.com/if-faber/IF-home-server.git /opt/if-home-server
sudo /opt/if-home-server/if-server.sh
```

W menu: **Upgrade** — program zapyta m.in. o hasło do udostępniania plików i PIN do strony
startowej. Później wystarczy `sudo if-server`. Strona startowa: `http://<adres-serwera>`.

## Testy (wersja 0.2.0)

| Test | Sprzęt | Wynik |
|---|---|---|
| Czysta instalacja Debiana 13 i Upgrade wszystkich składników | HP t730 Thin Client | 12 z 12, Cockpit i Dockge działają po restarcie |
| Serwer zainstalowany starym skryptem: rozpoznanie i uzupełnienie | HP t730 Thin Client | rozpoznane 10 składników, uzupełnione 2 |
| Rozpoznanie, aktualizacje programu, hasło roota | Fujitsu Esprimo Q920 | bez błędów |

## Historia projektu

Do wersji 0.2.5 serwer i strona były osobnymi projektami (strona: repozytorium
[if-startpage](https://github.com/if-faber/if-startpage), ostatnia osobna wersja v0.1.7.2).
Połączone w v0.3.0: drobne niezgodności przy łączeniu dwóch projektów wymagały wiedzy
i terminala — jako jedna całość instalują się poprawnie. Historia zmian strony:
[strona/version-changelog.md](strona/version-changelog.md).

## Licencja

MIT — zobacz [LICENSE](LICENSE).
