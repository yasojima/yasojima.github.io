"""Copy an explicit, reviewed inventory; never publish the repository root."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from check_offline import check_distribution
INVENTORY = HERE / 'pages-inventory.json'

def expected():
    return json.loads(INVENTORY.read_text())['files']

def assert_file(root, name, sha):
    relative = Path(name)
    if relative.is_absolute() or '..' in relative.parts or name.startswith('.github/'):
        raise ValueError('Invalid inventory path: ' + name)
    target = root / relative
    if any((root / Path(*relative.parts[:n])).is_symlink() for n in range(1, len(relative.parts)+1)):
        raise ValueError('Symlink: ' + name)
    data = target.read_bytes()
    if hashlib.sha256(data).hexdigest() != sha:
        raise ValueError('Unreviewed bytes: ' + name)
    return data

def verify(stage):
    allowed = expected()
    entries = list(stage.rglob('*'))
    if any(p.is_symlink() for p in entries):
        raise ValueError('Symlink in artifact')
    actual = {p.relative_to(stage).as_posix() for p in entries if p.is_file()}
    if actual != set(allowed):
        raise ValueError('Staged inventory mismatch')
    for name, sha in allowed.items():
        assert_file(stage, name, sha)
    result = check_distribution(stage / 'servicelife-ja')
    manifest = [{'path': name, 'size': (stage/name).stat().st_size, 'sha256': allowed[name]} for name in sorted(allowed)]
    encoded = (json.dumps(manifest, ensure_ascii=False, indent=2)+'\n').encode()
    stage.with_name(stage.name+'.manifest.json').write_bytes(encoded)
    return {'publishedFiles': len(actual), 'bytes': sum(x['size'] for x in manifest),
            'manifestSha256': hashlib.sha256(encoded).hexdigest(), 'distribution': result}

def stage(repo, output):
    allowed = expected()
    tracked = set(filter(None, subprocess.check_output(['git', 'ls-files', '-z'], cwd=repo).decode().split('\0')))
    public = {p for p in tracked if not p.startswith('.github/') and p != '.gitattributes'}
    if public != set(allowed):
        raise ValueError('Repository public inventory changed; review required: ' + str(sorted(public ^ set(allowed))))
    if output.exists():
        raise ValueError('Use a new empty artifact directory')
    output.mkdir(parents=True)
    for name, sha in allowed.items():
        data = assert_file(repo, name, sha)
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return verify(output)

if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--verify':
        print(json.dumps(verify(Path(sys.argv[2]).resolve())))
    elif len(sys.argv) == 3:
        print(json.dumps(stage(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())))
    else:
        raise SystemExit('Usage: stage_pages.py REPOSITORY NEW_ARTIFACT | --verify ARTIFACT')
