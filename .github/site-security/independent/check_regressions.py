"""Known publication bypasses must remain rejected; uses the shipped parser."""
from pathlib import Path
import base64
import copy
import io
import json
import shutil
import sys
import tempfile
from check_distribution import check_distribution, load_policy, Inspector, Markup
from pypdf import PdfWriter
from pypdf.generic import NameObject, DictionaryObject, TextStringObject

checks=[]
def rejected(name, action):
    try: action()
    except (ValueError, KeyError, TypeError, OSError):
        checks.append({'name':name,'ok':True});return
    raise AssertionError('Accepted prohibited payload: '+name)

def run(root):
    policy=load_policy();check_distribution(root)
    code=[('protocol-relative',"fetch('//audit.invalid/collect')"),('split-url',"fetch('https:'+'//audit.invalid/collect')"),('license-domain-request',"fetch('https://opensource.org/licenses/MIT')"),('comment-only-protection',"/* fetch XMLHttpRequest sendBeacon serviceWorker WebSocket geolocation */")]
    for name,payload in code:rejected(name,lambda p=payload:Inspector(policy).code(p,name))
    for name,payload in [('nested-json',json.dumps(json.dumps({'image':'<img src="https://audit.invalid/pixel">'}))),('base64-html',base64.b64encode(b'<img src="//audit.invalid/pixel">').decode()),('same-origin-project','<img src="/other-project/pixel">'),('parent-project','<a href="../other-project/">go</a>'),('external-frame','<iframe src="//audit.invalid/frame"></iframe>'),('redirect','<meta http-equiv="refresh" content="0;url=https://audit.invalid/">')]:
        rejected(name,lambda p=payload:Inspector(policy).text(p,name,0))
    writer=PdfWriter();writer.add_blank_page(width=200,height=200);writer._root_object[NameObject('/OpenAction')]=DictionaryObject({NameObject('/S'):NameObject('/URI'),NameObject('/URI'):TextStringObject('https://audit.invalid/pdf')});buf=io.BytesIO();writer.write(buf);active=buf.getvalue()
    rejected('PDF original active URI',lambda:Inspector(policy).binary(active,'probe.pdf'))
    rejected('PDF nested Base64',lambda:Inspector(policy).walk({'nested':json.dumps({'pdf':base64.b64encode(active).decode()})},'probe.json'))
    with tempfile.TemporaryDirectory(prefix='independent-regression-') as temporary:
        candidate=Path(temporary)/'candidate';shutil.copytree(root,candidate)
        guard=candidate/'src/core/data-reader.js';original=guard.read_bytes();guard.write_text(code[-1][1]);rejected('published protection replaced with comments',lambda:check_distribution(candidate));guard.write_bytes(original)
        extra=candidate/'unexpected.html';extra.write_text('<img src="//audit.invalid/">');rejected('unlisted file',lambda:check_distribution(candidate));extra.unlink()
        target=candidate/'data/catalog.json';old=target.read_bytes();target.write_bytes(old+b' ');rejected('changed data after approval',lambda:check_distribution(candidate));target.write_bytes(old)
        extra.symlink_to(target);rejected('symbolic public entry',lambda:check_distribution(candidate));extra.unlink()
    return {'result':'PASS','checks':checks}
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: check_regressions.py EXACT_APP_DIRECTORY')
    print(json.dumps(run(Path(sys.argv[1]).resolve())))
