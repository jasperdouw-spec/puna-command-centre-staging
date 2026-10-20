#!/usr/bin/env python3
"""Package only committed source, deterministically; never read local secrets."""
import hashlib
import json
import pathlib
import subprocess
import sys
import zipfile

out = pathlib.Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
entries = subprocess.check_output(["git", "ls-tree", "-rz", "--full-tree", "HEAD"])
files = []
archive = out / "puna-source.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for entry in sorted(entries.rstrip(b"\0").split(b"\0"), key=lambda e: e.split(b"\t", 1)[1]):
        metadata, raw_path = entry.split(b"\t", 1)
        mode, kind, blob = metadata.decode().split()
        name = raw_path.decode()
        parts = pathlib.PurePosixPath(name).parts
        assert kind == "blob" and mode in ("100644", "100755"), name
        assert not name.startswith("/") and ".." not in parts, name
        assert not any(p in (".git", "node_modules", ".next", "work", "outputs", "test-artifacts") for p in parts), name
        assert not pathlib.PurePosixPath(name).name.startswith(".env") or name == ".env.example", name
        assert not name.endswith((".zip", ".tar", ".gz", ".pem", ".key")), name
        data = subprocess.check_output(["git", "cat-file", "blob", blob])
        assert b"-----BEGIN " + b"PRIVATE KEY-----" not in data, name
        info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = int(mode, 8) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data, compresslevel=9)
        files.append({"path": name, "git_blob": blob, "sha256": hashlib.sha256(data).hexdigest()})
names = [f["path"] for f in files]
assert len(names) == len(set(n.lower() for n in names)), "Case-colliding paths"
for required in ("package.json", "package-lock.json", "tsconfig.json", "next.config.mjs", "postcss.config.mjs", ".npmrc"):
    assert required in names, required
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(out / "SHA256SUMS").write_text(digest + "  puna-source.zip\n")
(out / "manifest.json").write_text(json.dumps({"commit": commit, "archive_sha256": digest, "files": files}, indent=2) + "\n")
print(json.dumps({"commit": commit, "archive_sha256": digest, "files": len(files)}))
