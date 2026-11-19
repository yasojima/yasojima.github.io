"""EXOPS local interactive demo. Run with Python 3.9+ on the preview Mac."""

import argparse
import base64
import binascii
import hashlib
import json
import mimetypes
import os
import re
import sqlite3
from datetime import date, datetime, timedelta
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from secrets import compare_digest, token_urlsafe
from urllib.parse import parse_qs, urlsplit

from documents import make_pdf
from crew import snapshot
from manage import manage
from model import (
    SERVICES,
    ZONE,
    by_id,
    closed_company,
    ident,
    now,
    record,
    seed,
    slot_rows,
    today,
    visible_token,
)
from operations import book, booking_action, field, password_ok, public_action

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
LOGO = ROOT.parent / "design" / "approved-logo"
BOOK_ACTIONS = {
    "schedule",
    "stage",
    "release",
    "report",
    "document",
    "message",
    "cash",
    "card",
    "other",
}
MAX_FILE = 5 * 1024 * 1024


def encode(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def expire_media(db, state):
    cutoff = (datetime.now(ZONE).date() - timedelta(days=183)).isoformat()
    expired = [
        m
        for b in state["bookings"]
        for m in b["media"]
        if not m.get("expired") and m["at"][:10] < cutoff
    ]
    for item in expired:
        db.execute("DELETE FROM files WHERE id=?", (item["id"],))
        item["expired"] = True
    return bool(expired)


def init(dbfile):
    dbfile.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(dbfile) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute(
            "CREATE TABLE IF NOT EXISTS demo (id INTEGER PRIMARY KEY, state TEXT NOT NULL, rev INTEGER NOT NULL)"
        )
        db.execute("CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,staff TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, content BLOB NOT NULL)")
        row = db.execute("SELECT state FROM demo WHERE id=1").fetchone()
        if not row:
            db.execute("INSERT INTO demo VALUES(1,?,1)", (encode(seed()),))
        else:
            state = json.loads(row[0])
            changed = expire_media(db, state)
            if "review" not in state["settings"]:
                state["settings"]["review"] = "https://harbour.example.invalid/review"
                changed = True
            if changed:
                db.execute("UPDATE demo SET state=?,rev=rev+1 WHERE id=1", (encode(state),))


def public_booking(state, token):
    if not token:
        raise ValueError("受付メールの専用リンクをご利用ください。")
    for b in state["bookings"]:
        if compare_digest(b["token"], token) and visible_token(b):
            return b
    raise ValueError("この予約の確認ページは無効です。")


def file_meta(raw):
    try:
        data = base64.b64decode(raw["data"], validate=True)
    except (KeyError, ValueError, binascii.Error):
        raise ValueError("ファイルを読み込めませんでした。")
    if not 0 < len(data) <= MAX_FILE:
        raise ValueError("デモの添付は1件5MBまでです。")
    if data.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif data.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        mime = "image/webp"
    elif data[4:8] == b"ftyp" and data[8:12] in (
        b"mp42",
        b"mp41",
        b"isom",
        b"iso5",
        b"avc1",
        b"M4V ",
        b"qt  ",
    ):
        mime = "video/quicktime" if data[8:12] == b"qt  " else "video/mp4"
    elif data.startswith(b"\x1a\x45\xdf\xa3"):
        mime = "video/webm"
    else:
        raise ValueError("JPEG・PNG・WebP画像、MP4・MOV・WebM動画を選択してください。")
    return dict(id=ident("F"), name=field(raw, "name", 150), mime=mime, at=now()), data


def attach_files(db, b, files, group):
    if group not in {"受付資料", "作業前", "作業後"} or not isinstance(files, list) or len(files) > 5:
        raise ValueError("1回につき5件まで添付できます。")
    for raw in files:
        item, content = file_meta(raw)
        item["group"] = group
        db.execute("INSERT INTO files VALUES(?,?)", (item["id"], content))
        b["media"].append(item)


def save_signed_invoice(b):
    if not b["confirmed"]:
        return
    invoices = [doc for doc in b["docs"] if doc["kind"] == "請求書"]
    if invoices and not invoices[-1].get("signed"):
        b["docs"].append(dict(invoices[-1], id=ident("D"), signed=b["signed"], at=now()))


class Api(BaseHTTPRequestHandler):
    server_version = "EXOPS-Local/1"

    def send_bytes(self, status, body, ctype, cookie=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        if cookie:
            self.send_header(
                "Set-Cookie", "exops_preview=" + cookie + "; Path=/; HttpOnly; SameSite=Strict"
            )
        self.end_headers()
        self.wfile.write(body)

    def json(self, payload, status=200, cookie=None):
        self.send_bytes(status, encode(payload).encode(), "application/json; charset=utf-8", cookie)

    def db(self):
        return sqlite3.connect(self.server.dbfile, timeout=8)

    def user(self, db, state):
        cookies = SimpleCookie(self.headers.get("Cookie", ""))
        raw = cookies.get("exops_preview")
        if raw:
            token = hashlib.sha256(raw.value.encode()).hexdigest()
            row = db.execute("SELECT staff FROM sessions WHERE token=?", (token,)).fetchone()
            if row:
                user = by_id(state["staff"], row[0])
                if user["active"]:
                    return user, token
        raise PermissionError("ログインしてください。")

    def do_GET(self):
        self.handle_call(False)

    def do_POST(self):
        self.handle_call(True)

    def handle_call(self, is_post):
        try:
            if self.headers.get("Host") not in self.server.hosts:
                raise PermissionError("このMacで開いてください。")
            if is_post:
                origin = self.headers.get("Origin")
                if origin and origin != "http://" + self.headers["Host"]:
                    raise PermissionError("無効な送信元です。")
            target = urlsplit(self.path)
            path = target.path
            query = {k: v[0] for k, v in parse_qs(target.query).items()}
            if not path.startswith("/api/"):
                if is_post:
                    return self.json({"error": "ページがありません。"}, 404)
                resource = {"/": "index.html", "/customer": "index.html"}.get(path)
                if resource:
                    filename = WEB / resource
                elif path in {"/logo.png", "/favicon.png"}:
                    filename = LOGO / (
                        "EX-OPS-logo-vertical-gold-transparent.png"
                        if path == "/logo.png"
                        else "ex-ops-favicon.png"
                    )
                else:
                    filename = (WEB / path.lstrip("/")).resolve()
                    if WEB not in filename.parents:
                        raise ValueError("無効なパスです。")
                if not filename.is_file():
                    return self.json({"error": "ページがありません。"}, 404)
                mime = mimetypes.guess_type(str(filename))[0] or "application/octet-stream"
                return self.send_bytes(200, filename.read_bytes(), mime)
            if path == "/api/health":
                return self.json({"app": "EXOPS-local-demo"})
            with self.db() as db:
                midnight_cleanup = getattr(self.server, "last_cleanup", "") != today()
                if midnight_cleanup and not is_post:
                    db.execute("BEGIN IMMEDIATE")
                if is_post:
                    if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                        raise ValueError("送信形式を確認してください。")
                    size = int(self.headers.get("Content-Length", "0"))
                    if size > 36 * 1024 * 1024:
                        raise ValueError("添付ファイルが大きすぎます。")
                    data = json.loads(self.rfile.read(size) or b"{}")
                    db.execute("BEGIN IMMEDIATE")
                row = db.execute("SELECT state,rev FROM demo WHERE id=1").fetchone()
                state, revision = json.loads(row[0]), row[1]
                if midnight_cleanup:
                    if expire_media(db, state):
                        revision += 1
                        db.execute(
                            "UPDATE demo SET state=?,rev=? WHERE id=1", (encode(state), revision)
                        )
                    if not is_post:
                        db.commit()
                        self.server.last_cleanup = today()
                if not is_post:
                    return self.read_route(db, state, revision, path, query)
                result, cookie, changed = self.write_route(db, state, path, data)
                if changed:
                    revision += 1
                    db.execute("UPDATE demo SET state=?,rev=? WHERE id=1", (encode(state), revision))
                db.commit()
                if midnight_cleanup:
                    self.server.last_cleanup = today()
                self.json(dict(result, revision=revision), cookie=cookie)
        except (ValueError, TypeError, KeyError, OverflowError) as exc:
            self.json(
                {"error": str(exc) if isinstance(exc, ValueError) else "入力内容を確認してください。"},
                400,
            )
        except PermissionError as exc:
            self.json({"error": str(exc)}, 401 if str(exc) == "ログインしてください。" else 403)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except sqlite3.Error:
            self.json({"error": "データを保存できませんでした。もう一度お試しください。"}, 503)

    def read_route(self, db, state, rev, path, q):
        cfg = state["settings"]
        if path == "/api/public":
            b = public_booking(state, q.get("token", ""))
            c = by_id(state["customers"], b["customer"])
            keys = (
                "id",
                "date",
                "start",
                "service",
                "status",
                "estimate",
                "final",
                "payment",
                "confirmed",
                "signed",
                "inputAt",
                "address",
                "version",
            )
            result = {k: b[k] for k in keys}
            sent = {m["doc"] for m in b["messages"] if m["doc"]}
            result.update(
                name=c["name"],
                company=cfg["company"],
                messages=b["messages"],
                docs=[d for d in b["docs"] if d["id"] in sent],
            )
            return self.json(result)
        if path == "/api/slots":
            day = q.get("date", today())
            date.fromisoformat(day)
            detailed = q.get("office") == "1"
            if detailed:
                self.user(db, state)
            length = int(q.get("length", "60")) if detailed else 60
            if length not in {30, 60, 90, 120, 180, 240}:
                raise ValueError("所要時間を確認してください。")
            return self.json(
                dict(
                    date=day,
                    today=today(),
                    company=cfg["company"],
                    services=SERVICES,
                    closed=closed_company(state, day),
                    slots=slot_rows(state, day, length, detailed),
                    weekly=cfg["weekly"],
                    holidays=cfg["holidays"],
                )
            )
        if path == "/api/pdf" and q.get("token"):
            b = public_booking(state, q["token"])
            if q.get("id") not in [m.get("doc") for m in b["messages"]]:
                raise PermissionError("未送付の帳票です。")
            return self.send_bytes(200, make_pdf(by_id(b["docs"], q["id"])), "application/pdf")
        u, _ = self.user(db, state)
        if path == "/api/crew":
            return self.json(snapshot(state, u))
        if path == "/api/revision":
            return self.json({"revision": rev})
        if path == "/api/state":
            for s in state["staff"]:
                s.pop("hash", None)
                if u["role"] != "管理者" and s["id"] != u["id"]:
                    s.pop("birthday", None)
                    s.pop("login", None)
            if u["role"] != "管理者":
                state["logs"] = []
                state["settings"] = {k: cfg[k] for k in ("company", "sender", "phone", "address")}
            return self.json(
                dict(state, me=u["id"], today=today(), now=now(), revision=rev, services=SERVICES)
            )
        if path == "/api/pdf":
            b = by_id(state["bookings"], q.get("booking"))
            return self.send_bytes(200, make_pdf(by_id(b["docs"], q.get("id"))), "application/pdf")
        if path == "/api/media":
            b = by_id(state["bookings"], q.get("booking"))
            item = by_id(b["media"], q.get("id"))
            if date.fromisoformat(item["at"][:10]) + timedelta(days=183) < datetime.now(ZONE).date():
                raise ValueError("保存期間を過ぎた写真・動画です。")
            row = db.execute("SELECT content FROM files WHERE id=?", (item["id"],)).fetchone()
            return self.send_bytes(200, row[0], item["mime"])
        return self.json({"error": "該当するデータがありません。"}, 404)

    def write_route(self, db, state, path, d):
        if path == "/api/login":
            if d.get("demo") in {"admin", "field"}:
                u = by_id(state["staff"], "S01" if d["demo"] == "admin" else "S02")
            else:
                u = next(
                    (s for s in state["staff"] if s["active"] and s["login"] == d.get("login")), None
                )
                if not u or not password_ok(field(d, "password", 150), u.get("hash", "")):
                    raise PermissionError("ログインIDとパスワードを確認してください。")
            previous = SimpleCookie(self.headers.get("Cookie", "")).get("exops_preview")
            if previous:
                db.execute(
                    "DELETE FROM sessions WHERE token=?",
                    (hashlib.sha256(previous.value.encode()).hexdigest(),),
                )
            token = token_urlsafe(28)
            db.execute(
                "INSERT INTO sessions VALUES(?,?)",
                (hashlib.sha256(token.encode()).hexdigest(), u["id"]),
            )
            record(state, u["id"], "ログイン")
            return {}, token, True
        if path == "/api/book":
            request_key = d.get("requestKey") or token_urlsafe(32)
            if not re.fullmatch(r"[a-zA-Z0-9_-]{32,64}", request_key):
                raise ValueError("予約フォームを開き直してください。")
            fingerprint = hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()
            b = next(
                (item for item in state["bookings"] if item.get("requestKey") == request_key), None
            )
            created = b is None
            if created:
                b = book(state, d)
                b.update(requestKey=request_key, fingerprint=fingerprint)
                attach_files(db, b, d.get("files", []), "受付資料")
            elif b["fingerprint"] != fingerprint:
                raise ValueError(
                    "この送信はすでに受け付けました。別の依頼は新しいフォームからお願いします。"
                )
            return {"id": b["id"], "customer": b["customer"], "token": b["token"]}, None, created
        if path == "/api/public-action":
            b = public_booking(state, d.get("token", ""))
            public_action(state, b, d)
            if d.get("action") == "confirm":
                save_signed_invoice(b)
            return {}, None, True
        u, token = self.user(db, state)
        if path == "/api/logout":
            db.execute("DELETE FROM sessions WHERE token=?", (token,))
            record(state, u["id"], "ログアウト")
            return {}, "signedout", True
        if path != "/api/action":
            raise ValueError("この操作を利用できません。")
        action = d.get("action")
        if action in BOOK_ACTIONS or action == "media":
            b = by_id(state["bookings"], d.get("id"))
            if action == "media":
                attach_files(db, b, d.get("files", []), field(d, "group"))
                record(state, u["id"], "現場の写真・動画を保存", b)
                b["version"] += 1
                result = {}
            else:
                result = booking_action(state, u, b, d)
        else:
            result = manage(state, u, d)
        return result, None, True

    def log_message(self, fmt, *args):
        # Customer-link tokens and personal details do not belong in request logs.
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=48731)
    parser.add_argument("--db", type=Path, default=ROOT / ".local" / "demo.sqlite3")
    args = parser.parse_args()
    os.umask(0o077)
    init(args.db)
    http = ThreadingHTTPServer(("127.0.0.1", args.port), Api)
    http.dbfile = args.db
    http.hosts = {f"127.0.0.1:{http.server_port}", f"localhost:{http.server_port}"}
    print(f"EXOPS  http://127.0.0.1:{http.server_port}/", flush=True)
    http.serve_forever()
