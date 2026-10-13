"""Kodowanie i dekodowanie projektu planera zapisanego w linku (#p=...).

Użycie:
  python tools/hp_link.py decode "<link albo sam kod>"      > projekt.json
  python tools/hp_link.py encode projekt.json [--base URL] [--extra "v=3d&cam=top"]

Format kodu: 'z' + base64url(deflate-raw(JSON)) albo 'j' + base64url(JSON) – zgodnie z js/storage.js.
"""
import argparse
import base64
import json
import re
import sys
import zlib

DEFAULT_BASE = "https://dfgrzyska.github.io/home-planner/"


def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def extract_code(link_or_code: str) -> str:
    m = re.search(r"[#&]p=([A-Za-z0-9_-]+)", link_or_code)
    return m.group(1) if m else link_or_code.strip()


def decode(link_or_code: str) -> dict:
    code = extract_code(link_or_code)
    raw = _b64d(code[1:])
    if code[0] == "z":
        raw = zlib.decompress(raw, -15)
    elif code[0] != "j":
        raise ValueError("Nieznany format kodu projektu")
    return json.loads(raw.decode("utf-8"))


def encode(doc: dict) -> str:
    raw = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    c = zlib.compressobj(9, zlib.DEFLATED, -15)
    return "z" + _b64e(c.compress(raw) + c.flush())


def build_link(doc: dict, base: str = DEFAULT_BASE, extra: str = "") -> str:
    url = base.split("#")[0] + "#p=" + encode(doc)
    return url + ("&" + extra.lstrip("&") if extra else "")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("decode")
    d.add_argument("link")
    e = sub.add_parser("encode")
    e.add_argument("file")
    e.add_argument("--base", default=DEFAULT_BASE)
    e.add_argument("--extra", default="")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    if a.cmd == "decode":
        print(json.dumps(decode(a.link), ensure_ascii=False, indent=1))
    else:
        with open(a.file, encoding="utf-8") as f:
            print(build_link(json.load(f), a.base, a.extra))


if __name__ == "__main__":
    main()
