"""Zamienia render 3D w fotorealistyczną wizualizację przez lokalne ComfyUI (API HTTP).

Użycie:
  python tools/comfy.py --image renders/x/kitchen_3d.png --prompt-file renders/x/prompt.txt --out renders/x/kitchen_photo.png
  python tools/comfy.py --image a.png --prompt "..." --out b.png --workflow qwen-image-2.1 --ref inspiracja.jpg --count 2
  python tools/comfy.py --check            # czy ComfyUI działa i ma modele z wybranego workflow

Workflow to szablony w tools/workflows/*.json (format API ComfyUI) z polami {{IMAGE}}, {{PROMPT}},
{{NEGATIVE}}, {{SEED}}, {{REF}} (opcjonalny obraz referencyjny – usuwany, gdy nie podano --ref).
Ustawienia domyślne: tools/config.json, nadpisywane przez tools/config.local.json (nie trafia do repo).
"""
import argparse
import json
import mimetypes
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_config() -> dict:
    cfg = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    local = HERE / "config.local.json"
    if local.exists():
        cfg.update(json.loads(local.read_text(encoding="utf-8")))
    return cfg


def http(url, data=None, headers=None, timeout=60):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def get_json(url, timeout=30):
    return json.loads(http(url, timeout=timeout))


def server_ok(base) -> bool:
    try:
        get_json(base + "/system_stats", timeout=3)
        return True
    except Exception:
        return False


def upload(base, path: Path) -> str:
    boundary = uuid.uuid4().hex
    ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    name = f"hp_{uuid.uuid4().hex[:8]}_{path.name}"
    body = b"".join([
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{name}\"\r\nContent-Type: {ctype}\r\n\r\n".encode(),
        path.read_bytes(),
        f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{boundary}--\r\n".encode(),
    ])
    res = json.loads(http(base + "/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}))
    return (res.get("subfolder") + "/" if res.get("subfolder") else "") + res["name"]


def fill(node, values):
    if isinstance(node, dict):
        return {k: fill(v, values) for k, v in node.items()}
    if isinstance(node, list):
        return [fill(v, values) for v in node]
    if isinstance(node, str) and node.startswith("{{") and node.endswith("}}"):
        return values[node[2:-2]]
    return node


def build_graph(workflow: str, values: dict) -> dict:
    tpl = json.loads((HERE / "workflows" / f"{workflow}.json").read_text(encoding="utf-8"))
    graph = {k: v for k, v in tpl.items() if not k.startswith("_")}
    if values.get("REF") is None:
        # bez obrazu referencyjnego: usuń jego LoadImage i wszystkie wejścia, które z niego korzystają
        drop = {k for k, n in graph.items() if n["inputs"].get("image") == "{{REF}}"}
        for k in drop:
            graph.pop(k)
        for node in graph.values():
            for key in [k for k, v in node["inputs"].items() if isinstance(v, list) and v and v[0] in drop]:
                del node["inputs"][key]
    return fill(graph, values)


def _options(spec):
    if not spec:
        return None
    if isinstance(spec[0], list):
        return spec[0]
    if spec[0] == "COMBO" and len(spec) > 1 and isinstance(spec[1], dict):
        return spec[1].get("options")
    return None


def missing_models(base, workflow: str) -> list:
    """Sprawdza, czy pliki modeli z szablonu są widoczne dla ComfyUI."""
    tpl = json.loads((HERE / "workflows" / f"{workflow}.json").read_text(encoding="utf-8"))
    missing = []
    for node in tpl.values():
        if not isinstance(node, dict) or "class_type" not in node:
            continue
        info = get_json(base + "/object_info/" + urllib.parse.quote(node["class_type"]))
        if not info:
            missing.append(f"węzeł {node['class_type']} (zaktualizuj ComfyUI / doinstaluj rozszerzenie)")
            continue
        inputs = info[node["class_type"]]["input"]
        req = {**inputs.get("required", {}), **inputs.get("optional", {})}
        for key, val in node["inputs"].items():
            opts = _options(req.get(key))
            if isinstance(val, str) and opts is not None and val not in opts and not val.startswith("{{"):
                missing.append(f"{node['class_type']}.{key} = {val}")
    return missing


def run(base, graph, out: Path, timeout=1800) -> list:
    client = uuid.uuid4().hex
    try:
        res = json.loads(http(base + "/prompt", json.dumps({"prompt": graph, "client_id": client}).encode(), {"Content-Type": "application/json"}))
    except urllib.error.HTTPError as e:
        raise SystemExit("ComfyUI odrzuciło workflow:\n" + e.read().decode("utf-8", "replace")[:3000])
    pid = res["prompt_id"]
    start = time.time()
    while time.time() - start < timeout:
        time.sleep(2)
        hist = get_json(base + "/history/" + pid)
        if pid not in hist:
            continue
        entry = hist[pid]
        status = entry.get("status", {})
        if status.get("status_str") == "error":
            msgs = [m for m in status.get("messages", []) if m[0] == "execution_error"]
            raise SystemExit("Błąd wykonania w ComfyUI: " + json.dumps(msgs, ensure_ascii=False)[:3000])
        saved = []
        for node_out in entry.get("outputs", {}).values():
            for img in node_out.get("images", []):
                if img.get("type") != "output":
                    continue
                q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img["subfolder"], "type": img["type"]})
                data = http(base + "/view?" + q, timeout=120)
                target = out if not saved else out.with_name(f"{out.stem}_{len(saved) + 1}{out.suffix}")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                saved.append(target)
        if saved:
            return saved
    raise SystemExit("Przekroczono czas oczekiwania na ComfyUI")


def main():
    cfg = load_config()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image")
    ap.add_argument("--prompt")
    ap.add_argument("--prompt-file")
    ap.add_argument("--negative", default=cfg.get("negative", ""))
    ap.add_argument("--out")
    ap.add_argument("--workflow", default=cfg["workflow"])
    ap.add_argument("--ref", help="obraz referencyjny stylu (tylko workflow obsługujące wiele obrazów)")
    ap.add_argument("--seed", type=int)
    ap.add_argument("--count", type=int, default=1, help="liczba wariantów (różne seedy)")
    ap.add_argument("--cfg", type=float, help="nadpisz CFG (przy Qwen 2.1 > 1 włącza negatywny prompt, ~2x dłużej)")
    ap.add_argument("--steps", type=int, help="nadpisz liczbę kroków")
    ap.add_argument("--url", default=cfg["comfy_url"])
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    base = a.url.rstrip("/")

    if not server_ok(base):
        print(f"COMFY_OFFLINE: ComfyUI nie odpowiada pod {base}", file=sys.stderr)
        sys.exit(2)
    if a.check:
        miss = missing_models(base, a.workflow)
        if miss:
            print("Brakuje:\n  " + "\n  ".join(miss))
            sys.exit(3)
        print(f"OK – ComfyUI działa, workflow '{a.workflow}' ma wszystkie modele.")
        return

    if not (a.image and a.out and (a.prompt or a.prompt_file)):
        ap.error("--image, --out i --prompt/--prompt-file są wymagane")
    prompt = a.prompt or Path(a.prompt_file).read_text(encoding="utf-8").strip()
    image = upload(base, Path(a.image))
    ref = upload(base, Path(a.ref)) if a.ref else None
    out = Path(a.out)
    results = []
    for i in range(a.count):
        seed = a.seed + i if a.seed is not None else random.randint(1, 2**48)
        graph = build_graph(a.workflow, {"IMAGE": image, "PROMPT": prompt, "NEGATIVE": a.negative, "SEED": seed, "REF": ref})
        for node in graph.values():
            if node["class_type"] == "KSampler":
                if a.cfg is not None: node["inputs"]["cfg"] = a.cfg
                if a.steps is not None: node["inputs"]["steps"] = a.steps
        target = out if i == 0 else out.with_name(f"{out.stem}_v{i + 1}{out.suffix}")
        t0 = time.time()
        files = run(base, graph, target)
        print(f"{files[0]}  (seed {seed}, {time.time() - t0:.0f} s)")
        results += files
    return results


if __name__ == "__main__":
    main()
