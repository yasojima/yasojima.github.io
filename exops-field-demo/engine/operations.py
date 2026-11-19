"""Mutations are called inside one SQLite transaction."""

import hashlib
import hmac
import re
from datetime import date, datetime, timedelta
from secrets import token_hex

from model import (
    SERVICES,
    ZONE,
    available,
    by_id,
    clock,
    closed_company,
    future_slot,
    ident,
    mins,
    new_booking,
    now,
    record,
    today,
    visible_token,
)


def field(data, key, limit=200, required=True):
    value = str(data.get(key, "") or "").strip()
    if len(value) > limit or (required and not value):
        raise ValueError("入力内容を確認してください。")
    return value


def day_of(data, key="date"):
    day = field(data, key, 10)
    date.fromisoformat(day)
    return day


def amount(data):
    from decimal import Decimal, InvalidOperation

    try:
        value = Decimal(str(data.get("amount", "")))
        if (
            not value.is_finite()
            or not 0 <= value <= 10000000
            or value != value.quantize(Decimal(".01"))
        ):
            raise ValueError
        return float(value)
    except (ValueError, InvalidOperation):
        raise ValueError("金額は0以上、小数点以下2桁までで入力してください。")


def password_hash(value):
    salt = token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", value.encode(), salt.encode(), 240000).hex()
    return salt + "." + digest


def password_ok(value, saved):
    if "." not in saved:
        return False
    salt, digest = saved.split(".", 1)
    return hmac.compare_digest(
        digest, hashlib.pbkdf2_hmac("sha256", value.encode(), salt.encode(), 240000).hex()
    )


def admin(staff):
    if staff["role"] != "管理者":
        raise PermissionError("管理者権限のあるスタッフにご確認ください。")


def message(state, b, actor, title, body, doc="", inbound=False):
    office = state["settings"]["sender"]
    email = by_id(state["customers"], b["customer"])["email"]
    b["messages"].append(
        dict(
            at=now(),
            actor=actor,
            subject=title,
            body=body,
            doc=doc,
            sender=email if inbound else office,
            to=office if inbound else email,
            direction="受信" if inbound else "送信",
        )
    )


def customer_for(state, data):
    email = field(data, "email", 150).lower()
    phone = field(data, "phone", 32)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or not re.fullmatch(
        r"[+\d() \-]{6,32}", phone
    ):
        raise ValueError("メールアドレスと電話番号を確認してください。")
    norm = lambda val: re.sub(r"\D", "", val)
    for c in state["customers"]:
        if c["email"].lower() == email and norm(c["phone"]) == norm(phone):
            return c
    c = dict(
        id=ident("U"),
        name=field(data, "name", 100),
        email=email,
        phone=phone,
        address=field(data, "address"),
        area=field(data, "area", 80),
        gender="",
        memo="",
        tags=[],
        created=today(),
    )
    state["customers"].append(c)
    return c


def book(state, data):
    day = day_of(data)
    start = field(data, "start", 5)
    service = field(data, "service")
    if service not in SERVICES or not future_slot(day, start) or mins(start) % 30:
        raise ValueError("受付可能な日時とサービスを選んでください。")
    staff, cars = available(state, day, start, 60)
    if not (staff and cars):
        raise ValueError("この枠は受付を終了しました。別の時間をお選びください。")
    c = customer_for(state, data)
    b = new_booking(
        c["id"],
        day,
        start,
        60,
        staff[0],
        cars[0],
        service,
        field(data, "address"),
        field(data, "notes", 1500, False),
    )
    state["bookings"].append(b)
    message(
        state,
        b,
        "OPS",
        "無料見積もりの受付",
        "受付番号は "
        + b["id"]
        + " です。当日は予約確認と到着予定をメールでご案内します。前の現場で遅れる場合は改めてご連絡します。",
    )
    record(state, "お客様", "Webで無料見積もりを依頼", b)
    return b


def public_action(state, b, d):
    if not visible_token(b):
        raise ValueError("この予約の確認ページは有効期限を過ぎています。")
    action = d.get("action")
    if action == "reply":
        message(state, b, "お客様", "お客様からの返信", field(d, "body", 3000), inbound=True)
        label = "お客様から返信"
    elif action in {"startSign", "confirm"}:
        if b["final"] is None or b["status"] in {"declined", "cancelled"}:
            raise ValueError("作業内容と確定金額のご案内をお待ちください。")
        if b["confirmed"]:
            return
        b["inputAt"] = b["inputAt"] or now()
        if action == "confirm":
            if str(d.get("version")) != str(b["version"]):
                raise ValueError(
                    "予約の内容が更新されました。再読み込みし、金額をもう一度ご確認ください。"
                )
            b.update(signed=field(d, "name", 100), confirmed=now(), status="done")
            review = state["settings"].get("review", "")
            if review:
                message(
                    state,
                    b,
                    "OPS",
                    "ご利用のお礼と口コミのお願い",
                    "ご利用いただきありがとうございました。よろしければ、こちらからご感想をお寄せください。\n"
                    + review,
                )
        label = "お客様が作業完了を確認" if action == "confirm" else "お客様が完了確認の入力を開始"
    elif action == "cardResult":
        result = field(d, "result")
        if result not in {"完了", "保留", "失敗"} or b["payment"] not in {"案内済み", "保留", "失敗"}:
            raise ValueError("有効なカード決済案内が必要です。")
        if result == "完了":
            b.update(payment="精算済み", method="カード", paidAt=now(), paidBy="模擬決済会社")
        else:
            b.update(payment=result, method="カード")
        label = "カード決済結果（模擬） " + result
    elif action == "cancel":
        if b["status"] not in {"booked", "enroute"} or b["payment"] == "精算済み":
            raise ValueError("この段階の取消は業者にご連絡ください。")
        b.update(status="cancelled", released=now())
        label = "お客様が予約を取消"
    else:
        raise ValueError("操作を選択してください。")
    b["version"] += 1
    record(state, "お客様" if action != "cardResult" else "模擬決済会社", label, b)


def booking_action(state, user, b, d):
    action = d["action"]
    if "version" in d and int(d["version"]) != b["version"]:
        raise ValueError("別の画面で予約が更新されました。再読み込みしてから操作してください。")
    label = ""
    result = {}
    if action == "schedule":
        if b["status"] not in {"booked", "enroute"}:
            raise ValueError("訪問開始後は日時を変更できません。")
        day = day_of(d)
        start = field(d, "start", 5)
        length = int(d.get("duration", 60))
        if length not in [30, 60, 90, 120, 180, 240]:
            raise ValueError("所要時間を選んでください。")
        staff, cars = available(state, day, start, length, b["id"])
        if d.get("staff") not in staff or d.get("vehicle") not in cars:
            raise ValueError("指定の時間はスタッフまたは車両が空いていません。")
        previous = b["date"] + " " + b["start"] + " ／ " + b["staff"] + "・" + b["vehicle"]
        b.update(date=day, start=start, duration=length, staff=d["staff"], vehicle=d["vehicle"])
        label = (
            "訪問日時・配車を更新（"
            + previous
            + " → "
            + day
            + " "
            + start
            + " ／ "
            + b["staff"]
            + "・"
            + b["vehicle"]
            + "）"
        )
    elif action == "stage":
        stage = d.get("stage")
        prior = b["status"]
        transitions = {
            "enroute": {"booked"},
            "onsite": {"booked", "enroute"},
            "working": {"onsite"},
            "declined": {"booked", "enroute", "onsite"},
            "cancelled": {"booked", "enroute"},
        }
        if prior not in transitions.get(stage, set()) or (
            stage in {"declined", "cancelled"} and b["payment"] == "精算済み"
        ):
            raise ValueError("現在の状態からは変更できません。")
        if stage == "onsite":
            b["arrival"] = now()
        elif stage == "working":
            b["began"] = now()
        elif stage == "cancelled":
            b["released"] = now()
        b["status"] = stage
        label = {
            "enroute": "現場へ出発",
            "onsite": "到着を記録",
            "working": "作業を開始",
            "declined": "見積もりのみで終了",
            "cancelled": "予約を取消",
        }[stage]
    elif action == "release":
        if b["status"] not in {"done", "declined"} or b["released"]:
            raise ValueError("完了確認または見積もり終了後に記録できます。")
        minutes = int(d.get("buffer", 0))
        if minutes not in [0, 15, 30, 45, 60, 90, 120]:
            raise ValueError("片付け・移動の時間を選択してください。")
        b["released"] = (datetime.now(ZONE) + timedelta(minutes=minutes)).isoformat(timespec="seconds")
        label = "片付け・移動を含む次の稼働時刻を記録"
    elif action == "report":
        b["reported"] = field(d, "body", 3000)
        label = "完了報告を更新"
    elif action == "document":
        kind = d.get("kind")
        if kind not in {"見積書", "請求書"} or b["status"] in {"cancelled", "declined"}:
            raise ValueError("この予約で作成できる帳票を選んでください。")
        if kind == "請求書" and (b["payment"] != "未精算" or b["confirmed"]):
            raise ValueError("決済案内・精算または完了確認後の金額は確定しています。")
        value = amount(d)
        tax = None if d.get("tax") in (None, "") else amount({"amount": d["tax"]})
        if tax is not None and tax > value:
            raise ValueError("内税額は合計額以内で入力してください。")
        b["estimate" if kind == "見積書" else "final"] = value
        c = by_id(state["customers"], b["customer"])
        settings = state["settings"]
        snapshot = dict(
            id=ident("D"),
            kind=kind,
            amount=value,
            tax=tax,
            at=now(),
            name=c["name"],
            address=b["address"],
            booking=b["id"],
            service=b["service"],
            company=settings["company"],
            phone=settings["phone"],
            office=settings["address"],
            signed=b["signed"],
            sender=settings["sender"],
            note=field(d, "note", 500, False),
        )
        b["docs"].append(snapshot)
        result["doc"] = snapshot["id"]
        label = kind + "PDFを生成"
    elif action == "message":
        doc = field(d, "doc", 50, False)
        if doc:
            by_id(b["docs"], doc)
        message(state, b, user["id"], field(d, "subject", 160), field(d, "body", 3000), doc)
        label = "メールを送信（模擬）"
    elif action in {"cash", "card", "other"}:
        if (
            b["status"] in {"cancelled", "declined"}
            or b["payment"] == "精算済み"
            or b["final"] is None
            or b["final"] <= 0
        ):
            raise ValueError("未精算の予約に確定金額を入力してください。")
        if action == "card":
            b.update(payment="案内済み", method="カード")
            message(
                state,
                b,
                user["id"],
                "カード決済のご案内",
                "お客様ページの「カード決済を試す」からデモ決済へお進みください。",
            )
            label = "決済案内リンクを送信（模擬）"
        else:
            method = "現金" if action == "cash" else "その他"
            b.update(payment="精算済み", method=method, paidAt=now(), paidBy=user["id"])
            label = method + "の受領を記録"
    else:
        raise ValueError("この操作を利用できません。")
    b["version"] += 1
    record(state, user["id"], label, b)
    return result
