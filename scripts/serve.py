"""Serve the built app (dist/) and the data folder on localhost; no dependencies.
Usage: python3 scripts/serve.py [--port 8766]   (run `npm run build` first)"""
import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
DATA = ROOT / "data"
KINDS = {"dictionary", "vocabulary", "reading", "listening", "spelling"}


def build_data_index() -> dict:
    """Same rules as scripts/data-index.mjs: every data/*/dataset.json is one collection (or several under `collections`);
    folders without it (enrichment, syllables) are shared layers. Built per request so deleting a folder takes effect at once."""
    groups = []
    for folder in sorted(p for p in DATA.iterdir() if p.is_dir()):
        cfg_path = folder / "dataset.json"
        if not cfg_path.is_file():
            continue
        try:
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        except ValueError:
            continue
        rel = lambda f: f"data/{folder.name}/{f}"
        def one(item, cid):
            if not isinstance(item.get("label"), str) or not isinstance(item.get("file"), str) or not (folder / item["file"]).is_file() or item.get("kind") not in KINDS:
                return None
            out = {"id": cid, "label": item["label"].strip(), "file": rel(item["file"]), "kind": item["kind"]}
            if isinstance(item.get("notes"), str) and (folder / item["notes"]).is_file(): out["notes"] = rel(item["notes"])
            if isinstance(item.get("description"), str): out["description"] = item["description"]
            if isinstance(item.get("stories"), str) and (folder / item["stories"] / "index.json").is_file(): out["stories"] = rel(item["stories"])
            return out
        if isinstance(cfg.get("collections"), list):
            items = [one({"notes": cfg.get("notes"), "description": cfg.get("description"), **c}, f"{folder.name}/{c.get('name') or Path(str(c.get('file', ''))).stem}") for c in cfg["collections"]]
        else:
            items = [one(cfg, folder.name)]
        order = cfg.get("order") if isinstance(cfg.get("order"), (int, float)) else float("inf")
        groups.append((order, folder.name, [i for i in items if i]))
    groups.sort(key=lambda g: (g[0], g[1]))
    return {"collections": [i for g in groups for i in g[2]]}


class AppHandler(SimpleHTTPRequestHandler):
    """/data/... and /layers/... come from the project folder; everything else from dist/, and any path that is not a real
    file there falls back to dist/index.html so react-router deep links work. Always revalidates."""

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/data/index.json":
            body = json.dumps(build_data_index(), ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def translate_path(self, path):
        relative = path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
        for top in ("data", "layers"):   # collections and the shared word layers are served from the project folder
            if relative == top or relative.startswith(top + "/"):
                candidate = (ROOT / relative).resolve()
                if candidate.is_relative_to(ROOT / top) and candidate.is_file():
                    return str(candidate)
                return str(ROOT / top / "__missing__")
        candidate = (DIST / relative).resolve() if relative else DIST / "index.html"
        if relative and candidate.is_relative_to(DIST) and candidate.is_file():
            return str(candidate)
        return str(DIST / "index.html")

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    if not (DIST / "index.html").is_file():
        raise SystemExit("dist/index.html not found: run `npm run build` first.")
    handler = partial(AppHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Word by word: http://127.0.0.1:{args.port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
