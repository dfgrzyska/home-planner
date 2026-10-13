"""Renderuje ujęcia 3D projektu planera do plików PNG (headless Chrome / Edge).

Użycie:
  python tools/render3d.py --doc projekt.json --cams salon_balcony,kitchen --out renders/test
  python tools/render3d.py --link "<link z planera>" --cams all --out renders/test --size 1600x900

Domyślnie uruchamia własny lokalny serwer HTTP z plikami repozytorium (renderuje bieżący kod,
także niewypchnięty na GitHub Pages). --base pozwala wskazać inny adres aplikacji.
"""
import argparse
import functools
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hp_link import decode, encode  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CAMERAS = ["top", "salon_balcony", "salon_entry", "kitchen", "room2", "room3", "bath", "hall"]

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "google-chrome", "chromium", "chromium-browser", "microsoft-edge",
]


def find_browser() -> str:
    for b in BROWSERS:
        if os.path.isabs(b) and os.path.exists(b):
            return b
        if not os.path.isabs(b) and shutil.which(b):
            return shutil.which(b)
    raise SystemExit("Nie znaleziono Chrome ani Edge – zainstaluj jedną z przeglądarek.")


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve_repo():
    handler = functools.partial(_Quiet, directory=str(ROOT))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/"


def render(doc: dict, cams, out: Path, size=(1600, 900), base=None, time="day") -> list:
    out = out.resolve()  # Chrome zapisuje zrzut względem własnego katalogu – potrzebna ścieżka bezwzględna
    out.mkdir(parents=True, exist_ok=True)
    browser = find_browser()
    httpd = None
    if not base:
        httpd, base = serve_repo()
    code = encode(doc)
    files = []
    try:
        with tempfile.TemporaryDirectory(prefix="hp-chrome-") as prof:
            for cam in cams:
                suffix = "" if time == "day" else f"_{time}"
                target = out / f"{cam}{suffix}_3d.png"
                url = f"{base.split('#')[0]}#p={code}&shot=1&cam={cam}&t={time}"
                cmd = [
                    browser, "--headless=new", f"--user-data-dir={prof}", "--hide-scrollbars",
                    f"--window-size={size[0]},{size[1]}", "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist",
                    "--virtual-time-budget=20000", f"--screenshot={target}", url,
                ]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
                if not target.exists() or target.stat().st_size < 10_000:
                    raise SystemExit(f"Render ujęcia {cam} nie powiódł się ({target}).")
                print(target)
                files.append(target)
    finally:
        if httpd:
            httpd.shutdown()
    return files


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--doc", help="plik JSON projektu")
    src.add_argument("--link", help="link z planera (#p=...)")
    ap.add_argument("--cams", default="salon_balcony,kitchen,room2,room3", help=f"lista ujęć albo 'all': {', '.join(CAMERAS)}")
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", default="1600x900")
    ap.add_argument("--base", default=None, help="adres aplikacji (domyślnie lokalny serwer z repozytorium)")
    ap.add_argument("--time", default="day", choices=["day", "evening", "night"], help="pora dnia: dzień / wieczór / noc (światła Hue)")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    if a.doc:
        with open(a.doc, encoding="utf-8") as f:
            doc = json.load(f)
    else:
        doc = decode(a.link)
    cams = CAMERAS if a.cams == "all" else [c.strip() for c in a.cams.split(",") if c.strip()]
    bad = [c for c in cams if c not in CAMERAS]
    if bad:
        raise SystemExit(f"Nieznane ujęcia: {bad}. Dostępne: {CAMERAS}")
    w, h = (int(v) for v in a.size.lower().split("x"))
    render(doc, cams, Path(a.out), (w, h), a.base, a.time)


if __name__ == "__main__":
    main()
