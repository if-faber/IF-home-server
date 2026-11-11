#!/usr/bin/env python3
"""Sprawdza tłumaczenia instalatora (if-server i składniki).

Szuka w kodzie tekstów podanych do funkcji t i porównuje je z plikiem
jezyki/<kod>.sh. Wypisuje teksty bez tłumaczenia i tłumaczenia, których
kod już nie używa. Uruchomienie z głównego folderu repozytorium:

    python3 jezyki/sprawdz.py en

Kod wyjścia 1, gdy czegoś brakuje.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = [ROOT / "if-server.sh", *sorted((ROOT / "skladniki").glob("[0-9][0-9]-*.sh"))]

# t 'tekst' albo t "tekst" (bez zmiennych na początku — te są kluczami z listy niżej).
CALL = re.compile(r"""(?<![\w-])t (?:-k (\w+) )?(?:'([^']*)'|"((?:[^"\\$]|\\.)(?:[^"\\]|\\.)*)")""", re.S)

# Teksty przekazywane do t przez zmienną (t "$stan") — wpisane tu ręcznie.
DYNAMIC = [
    "haslo|ustawione", "haslo|brak", "haslo|nie udało się sprawdzić",   # root_password_state
    "zainstalowany", "rozpoznany",                     # skąd w pliku stanu
]

# Klucz w pliku języka: T['tekst']='tłumaczenie' (teksty z ' jako T["…"]).
ENTRY = re.compile(r"""^T\[(?:'([^']*)'|"((?:[^"\\]|\\.)*)")\]=""", re.M | re.S)


def unescape_double(text):
    return re.sub(r"\\([\\\"$`])", r"\1", text)


def code_keys():
    keys = {}
    for path in FILES:
        src = path.read_text(encoding="utf-8")
        for m in CALL.finditer(src):
            line_start = src.rfind("\n", 0, m.start()) + 1
            if src[line_start:m.start()].lstrip().startswith("#"):
                continue  # przykład w komentarzu
            key = m.group(2) if m.group(2) is not None else unescape_double(m.group(3))
            if m.group(1):
                key = f"{m.group(1)}|{key}"
            line = src.count("\n", 0, m.start()) + 1
            keys.setdefault(key, f"{path.relative_to(ROOT)}:{line}")
    for key in DYNAMIC:
        keys.setdefault(key, "(zmienna)")
    return keys


# Opis w run / run_sh / info / warn podany wprost (bez $(t ...)) — nie zostanie przetłumaczony.
# Także kolejny wiersz listy braków w sprawdz() (brak="${brak:+$brak
# }tekst") — wiersz zaczynający się od „}” i tekstu zamiast $(t ...) (audyt 11.11.2026).
BARE = re.compile(r"""^\s*(run|run_sh|info|warn)\s+(["'])(?!\$)|^\}(?!\$)[^\s"]""", re.M)


def bare_texts():
    found = []
    for path in FILES:
        src = path.read_text(encoding="utf-8")
        for m in BARE.finditer(src):
            line = src.count("\n", 0, m.start()) + 1
            text = src[m.start():src.find("\n", m.start())].strip()
            found.append(f"{path.relative_to(ROOT)}:{line}  {text[:90]}")
    return found


def lang_keys(code):
    src = (ROOT / "jezyki" / f"{code}.sh").read_text(encoding="utf-8")
    return {m.group(1) if m.group(1) is not None else unescape_double(m.group(2)) for m in ENTRY.finditer(src)}


def main():
    code = sys.argv[1] if len(sys.argv) > 1 else "en"
    used = code_keys()
    have = lang_keys(code)
    missing = [k for k in used if k not in have]
    unused = sorted(have - set(used))
    for k in missing:
        print(f"BRAK  {used[k]}  {k!r}")
    for k in unused:
        print(f"NIEUŻYWANE  {k!r}")
    bare = bare_texts()
    for b in bare:
        print(f"BEZ t  {b}")
    print(f"{code}: w kodzie {len(used)}, przetłumaczone {len(used) - len(missing)}, brak {len(missing)}, nieużywane {len(unused)}, bez t {len(bare)}")
    sys.exit(1 if missing or bare else 0)


if __name__ == "__main__":
    main()
