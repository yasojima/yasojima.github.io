"""Review-bound publication gate for the independently implemented demo.

The approval file is supplied only after code, behavior and browser review. This
module cannot generate or update that approval. The retained demo uses its own
unchanged policy and gate.
"""
from pathlib import Path
import hashlib
import json
import sys

HERE = Path(__file__).resolve().parent
PARSER = HERE.parents[1] / '確認用デモ'
if not PARSER.is_dir():
    PARSER = HERE.parent  # .github/site-security/independent in the Pages repo
sys.path.insert(0, str(PARSER))
from distribution_security import Inspector, Markup, MAX_BYTES


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_policy():
    policy = json.loads((HERE / 'reviewed-independent.json').read_text())
    if policy.get('schema') != 1 or policy.get('implementation') != 'independent':
        raise ValueError('Missing independent release approval')
    return policy


def check_distribution(folder):
    folder = Path(folder).resolve()
    policy = load_policy()
    entries = list(folder.rglob('*'))
    if any(p.is_symlink() for p in entries):
        raise ValueError('Symlink in independent output')
    files = {p.relative_to(folder).as_posix(): p for p in entries if p.is_file()}
    if set(files) != set(policy['files']):
        raise ValueError('Independent public inventory mismatch')
    for name, p in files.items():
        if digest(p.read_bytes()) != policy['files'][name]:
            raise ValueError(name + ': unreviewed bytes')
    inspector = Inspector(policy)
    for name, p in files.items():
        data = p.read_bytes()
        if len(data) > MAX_BYTES:
            raise ValueError(name + ': file exceeds limit')
        if p.suffix == '.pdf':
            inspector.binary(data, name)
        elif p.suffix in {'.js', '.css'}:
            inspector.code(data.decode('utf-8'), name)
        elif p.suffix in {'.html', '.svg'}:
            Markup(inspector, name).feed(data.decode('utf-8'))
        elif p.suffix == '.json':
            inspector.walk(json.loads(data), name)
        elif p.suffix not in {'.woff2', '.LICENSE', '.png'}:
            raise ValueError(name + ': unexpected distribution format')
    manifest = json.loads((folder / 'manifest.json').read_text())['files']
    if manifest != {k: v for k, v in policy['files'].items() if k != 'manifest.json'}:
        raise ValueError('Reviewed manifest differs from actual approved files')
    return {'files': len(files), 'pdfs': len(inspector.pdfs), 'result': 'PASS'}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: check_distribution.py EXACT_PUBLIC_DIRECTORY')
    print(json.dumps(check_distribution(sys.argv[1])))
