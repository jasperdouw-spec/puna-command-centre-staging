#!/usr/bin/env python3
"""CI-only archive verification and observed Hostinger standalone wrapping."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import zipfile

assert os.environ.get("GITHUB_ACTIONS") == "true"
assert os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted"
mode, archive_name, destination = sys.argv[1:4]
root = pathlib.Path(destination)
root.mkdir(parents=True, exist_ok=False)
with zipfile.ZipFile(archive_name) as z:
    names = z.namelist()
    assert len(names) == len(set(n.lower() for n in names))
    for name in names:
        path = pathlib.PurePosixPath(name)
        assert not path.is_absolute() and ".." not in path.parts
        assert not path.name.startswith(".env") or name == ".env.example"
        assert name not in ("node_modules", ".next")
    if mode == "baseline":
        ref = "12802b2f52d390f7418338293be3c0c3f744c10e"
        expected = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", ref], text=True).splitlines()
        assert sorted(names) == sorted(expected)
        for name in names:
            original = subprocess.check_output(["git", "show", ref + ":" + name])
            assert z.read(name) == original, name
        print("Verified all 59 received archive files against failed commit, including casing")
    else:
        manifest = json.loads(pathlib.Path(archive_name).with_name("manifest.json").read_text())
        assert hashlib.sha256(pathlib.Path(archive_name).read_bytes()).hexdigest() == manifest["archive_sha256"]
        assert sorted(names) == sorted(f["path"] for f in manifest["files"])
        for f in manifest["files"]:
            assert hashlib.sha256(z.read(f["path"])).hexdigest() == f["sha256"], f["path"]
    z.extractall(root)
assert json.loads((root / "tsconfig.json").read_text())["compilerOptions"]["paths"] == {"@/*": ["./*"]}
assert json.loads((root / "package.json").read_text())["scripts"]["build"] == "next build --webpack"
# Same observed provider transformation, only inside the disposable extracted tree.
# The original module (including security headers) is imported intact.
(root / "next.config.mjs").rename(root / "6ad794056a0f8.next.config.mjs")
(root / "next.config.mjs").write_text(
    'const configModule = await import("./6ad794056a0f8.next.config.mjs");\n'
    'const config = configModule.default ?? configModule;\n\n'
    'config.output = "standalone";\n\nexport default config;\n'
)
