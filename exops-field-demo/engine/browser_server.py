"""Run the demo's existing API against the visitor's own SQLite database."""

import base64
import io
import json
import sqlite3
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit

from server import Api, init


database = Path("/exops-field-demo-data-v1/preview.sqlite3")
init(database)
context = SimpleNamespace(dbfile=database, hosts={"preview"}, last_cleanup="")


class BrowserRequest(Api):
    def __init__(self, method, url, body, session):
        target = urlsplit(url)
        self.path = "/api/" + target.path + ("?" + target.query if target.query else "")
        self.server = context
        self.headers = {"Host": "preview", "Content-Type": "application/json",
                        "Content-Length": str(len(body)), "Cookie": "exops_preview=" + session}
        self.rfile = io.BytesIO(body)
        self.handle_call(method == "POST")

    def send_bytes(self, status, body, ctype, cookie=None):
        self.result = {"status": status, "ctype": ctype, "cookie": cookie,
                       "body": base64.b64encode(body).decode("ascii")}


def dispatch(method, url, body):
    with sqlite3.connect(database) as db:
        db.execute("CREATE TABLE IF NOT EXISTS preview_session (id INTEGER PRIMARY KEY, cookie TEXT)")
        row = db.execute("SELECT cookie FROM preview_session WHERE id=1").fetchone()
        cleanup_before = context.last_cleanup
        request = BrowserRequest(method, url, body.encode("utf-8"), row[0] if row else "")
        result = request.result
        if result["cookie"] is not None:
            db.execute("INSERT OR REPLACE INTO preview_session VALUES(1,?)", (result["cookie"],))
        result["persist"] = (method == "POST" and result["status"] < 400) or cleanup_before != context.last_cleanup
        del result["cookie"]
        return json.dumps(result)
