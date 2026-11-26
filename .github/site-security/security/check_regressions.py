"""Known bypasses must fail both the inventory gate and content inspection."""
import base64
import gzip
import io
import json
import shutil
import sys
import tempfile
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from distribution_security import Inspector, Markup, check_distribution, load_policy
from pdf_security import validate_pdf

checks = []
def rejects(name, operation):
    try:
        operation()
    except (ValueError, OSError) as exc:
        checks.append({'name': name, 'passed': True, 'reason': str(exc)[:180]})
    else:
        checks.append({'name': name, 'passed': False})

source = Path(sys.argv[1]).resolve()
assert check_distribution(source)['result'] == 'PASS'
checks.append({'name': 'current distribution remains valid', 'passed': True})
policy = load_policy()
code_examples = {
    'absolute fetch': "fetch('https://audit.example.invalid/collect')",
    'protocol-relative fetch': "fetch('//audit.example.invalid/collect')",
    'concatenated URL': 'fetch("https:" + "//audit.example.invalid/collect")',
    'license hostname used for fetch': "fetch('https://github.com/collect')",
    'computed URL': "fetch(String.fromCharCode(47,47)+'audit.example.invalid/collect')",
    'comment-only protection': "/* XMLHttpRequest sendBeacon serviceWorker WebSocket replace(navigator, 'geolocation', undefined) */",
}
for name, code in code_examples.items():
    rejects('content: ' + name, lambda c=code: Inspector(policy).code(c, 'test.js'))

payloads = {
    'same-host other project link': '<a href="https://yasojima.github.io/contact/">test</a>',
    'root other project image': '<img src="/assets/collect.png">',
    'traversal image': '<img src="../other/collect.png">',
    'encoded traversal': '<img src="%2e%2e/other/collect.png">',
    'protocol-relative image': '<img src="//audit.example.invalid/x">',
    'SVG external reference': '<svg><use xlink:href="//audit.example.invalid/x"/></svg>',
    'second srcset': '<img srcset="brand.svg 1x, //audit.example.invalid/x 2x">',
    'inline event': '<button onclick="fetch(\'//audit.example.invalid/x\')">test</button>',
    'CSS import': '<style>@import "//audit.example.invalid/x";</style>',
    'nested JSON HTML': json.dumps(json.dumps({'inner': '<img src="//audit.example.invalid/x">'})),
    'Base64 HTML': base64.b64encode(b'<img src="//audit.example.invalid/x">').decode(),
    'data URL HTML': 'data:text/html;base64,' + base64.b64encode(b'<img src="//audit.example.invalid/x">').decode(),
}
for name, payload in payloads.items():
    rejects('content: ' + name, lambda p=payload: Inspector(policy).walk({'payload': p}, 'test.json'))

writer = PdfWriter()
writer.add_blank_page(width=300, height=300)
writer._root_object[NameObject('/OpenAction')] = writer._add_object(DictionaryObject({NameObject('/S'): NameObject('/URI'), NameObject('/URI'): TextStringObject('https://audit.example.invalid/pdf')}))
stream = io.BytesIO(); writer.write(stream); pdf = stream.getvalue()
rejects('PDF external action', lambda: validate_pdf(pdf))
rejects('PDF inside Base64 JSON', lambda: Inspector(policy).walk({'pdf': base64.b64encode(pdf).decode()}, 'contract.json'))
# An unreferenced action is still forbidden; it must not evade a root-only walk.
writer = PdfWriter(); writer.add_blank_page(width=300, height=300)
writer._add_object(DictionaryObject({NameObject('/S'):NameObject('/JavaScript'),NameObject('/JS'):TextStringObject('app.launchURL("https://audit.example.invalid/")')}))
stream = io.BytesIO(); writer.write(stream)
rejects('PDF unreferenced JavaScript', lambda: validate_pdf(stream.getvalue()))

with tempfile.TemporaryDirectory(prefix='sukimakun-regression-') as temp:
    clone = Path(temp) / 'public'; shutil.copytree(source, clone)
    guard = clone / 'privacy-guard.js'; original = guard.read_bytes()
    for name, code in code_examples.items():
        guard.write_text(code)
        rejects('distribution: ' + name, lambda: check_distribution(clone))
    guard.write_bytes(original)
    target = clone / 'catalog.json'; original = target.read_bytes()
    for name, payload in payloads.items():
        changed = json.loads(original); changed['auditProbe'] = payload
        target.write_text(json.dumps(changed))
        rejects('distribution: ' + name, lambda: check_distribution(clone))
    target.write_bytes(original)
    rogue = clone / 'rogue.js'; rogue.write_text('fetch("//audit.example.invalid/")')
    rejects('unlisted public file', lambda: check_distribution(clone)); rogue.unlink()
    rogue.symlink_to(source, target_is_directory=True)
    rejects('symlink directory', lambda: check_distribution(clone)); rogue.unlink()
    assert check_distribution(clone)['result'] == 'PASS'
print(json.dumps({'checks': checks, 'count': len(checks)}, indent=2))
if not all(c['passed'] for c in checks):
    raise SystemExit('Regression failed')
