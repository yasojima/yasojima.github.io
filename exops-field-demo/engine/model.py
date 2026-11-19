"""Domain rules for the single-company, loopback EXOPS interactive preview."""

from datetime import date, datetime, timedelta
from secrets import token_hex, token_urlsafe
from zoneinfo import ZoneInfo

ZONE = ZoneInfo("Australia/Sydney")
SERVICES = ["不用品回収", "ハウスクリーニング", "引っ越し・搬出"]
CLOSED = {"cancelled", "declined"}


def now():
    return datetime.now(ZONE).isoformat(timespec="seconds")


def today(offset=0):
    return (datetime.now(ZONE).date() + timedelta(days=offset)).isoformat()


def ident(prefix):
    return prefix + "-" + token_hex(4).upper()


def mins(value):
    parsed = datetime.strptime(value, "%H:%M")
    return parsed.hour * 60 + parsed.minute


def clock(value):
    return "%02d:%02d" % divmod(int(value), 60)


def by_id(rows, key):
    for item in rows:
        if item["id"] == key:
            return item
    raise ValueError("対象の記録が見つかりません。画面を更新してください。")


def record(state, actor, action, reservation=None, customer=""):
    state["logs"].insert(
        0,
        dict(
            at=now(),
            actor=actor,
            action=action,
            booking=reservation["id"] if reservation else "",
            customer=reservation["customer"] if reservation else customer,
        ),
    )


def new_booking(customer, day, start, duration, staff, vehicle, service, address, notes):
    return dict(
        id=ident("R"),
        customer=customer,
        date=day,
        start=start,
        duration=duration,
        staff=staff,
        vehicle=vehicle,
        service=service,
        address=address,
        notes=notes,
        issued=now(),
        requested=day + " " + start,
        status="booked",
        arrival="",
        began="",
        confirmed="",
        inputAt="",
        signed="",
        released="",
        reported="",
        estimate=None,
        final=None,
        payment="未精算",
        method="",
        paidAt="",
        paidBy="",
        docs=[],
        messages=[],
        media=[],
        token=token_urlsafe(24),
        version=1,
    )


def seed():
    staff = [
        dict(id=i, name=n, nick=k, role=r, login=l, birthday=b, off=[], active=True)
        for i, n, k, r, l, b in [
            ("S01", "高橋 美咲", "高橋", "管理者", "takahashi", "1991-04-14"),
            ("S02", "田中 健", "田中", "一般スタッフ", "tanaka", "1993-06-12"),
            ("S03", "佐藤 はるか", "佐藤", "一般スタッフ", "sato", "1995-03-08"),
            ("S04", "鈴木 亮", "鈴木", "一般スタッフ", "suzuki", "1990-10-26"),
        ]
    ]
    vehicles = [
        dict(
            id=i,
            maker=m,
            model=v,
            plate=p,
            start=today(-320),
            due=today(d),
            checked=today(-320),
            done=False,
            active=True,
        )
        for i, m, v, p, d in [
            ("V01", "いすゞ", "エルフ 2t", "DEMO-01", 24),
            ("V02", "トヨタ", "ハイエース", "DEMO-02", 76),
            ("V03", "日野", "デュトロ 3t", "DEMO-03", 214),
        ]
    ]
    names = [
        "山本 美穂",
        "小林 拓也",
        "伊藤 由香",
        "渡辺 直人",
        "加藤 里奈",
        "松本 悠",
        "吉田 恵",
        "佐々木 蓮",
        "山田 明",
        "中村 さくら",
        "岡田 司",
        "井上 葵",
    ]
    areas = ["Surry Hills", "Newtown", "Glebe", "Pyrmont", "Redfern", "Waterloo"]
    customers = []
    for i, name in enumerate(names):
        area = areas[i % len(areas)]
        customers.append(
            dict(
                id="U-%04d" % (1801 + i),
                name=name,
                phone="0491 570 %03d" % (10 + i),
                email="sample%02d@example.invalid" % i,
                area=area,
                address="%d Demo Lane, %s, NSW" % (i + 1, area),
                gender="",
                memo="",
                tags=[],
                created=today(-32 + i),
            )
        )
    state = dict(
        staff=staff,
        vehicles=vehicles,
        customers=customers,
        bookings=[],
        blocks=[],
        logs=[],
        tags=[
            dict(id="T%d" % i, name=n, color="#b93438")
            for i, n in enumerate(["要注意", "クレーマー", "返金歴あり", "キャンセル歴あり"])
        ],
        settings=dict(
            company="ハーバー訪問サービス",
            sender="desk@harbour.example.invalid",
            url="https://harbour.example.invalid",
            provider="Square",
            review="https://harbour.example.invalid/review",
            weekly=[],
            holidays=[],
            address="18 Demo Street, Sydney NSW",
            phone="0491 570 099",
        ),
    )
    # All examples are fictional. Offsets keep the working agenda useful on the day it is first opened.
    for offset in range(-13, 5):
        count = 7 if offset == 0 else (3 if offset > 0 else 2)
        for j in range(count):
            position = (offset * 3 + j) % len(customers)
            c = customers[position]
            s = staff[1 + j % 3]["id"]
            v = vehicles[j % 3]["id"]
            time = (
                ["08:00", "09:00", "10:00", "11:30", "13:00", "14:00", "15:00"]
                if offset == 0
                else ["09:00", "11:00", "14:00"]
            )[j]
            day = today(offset)
            b = new_booking(
                c["id"],
                day,
                time,
                [60, 90, 60][j % 3],
                s,
                v,
                SERVICES[(j + offset) % 3],
                c["address"],
                [
                    "玄関横に駐車できます。インターホンでお呼びください。",
                    "エレベーターを利用できます。",
                    "到着前にメールでお知らせください。",
                ][j % 3],
            )
            b["issued"] = today(offset - 3) + "T10:00:00+11:00"
            b["estimate"] = [240, 380, 160, 520, 280, 440][(j + offset) % 6]
            if offset < 0:
                b.update(
                    status="done",
                    final=b["estimate"],
                    payment="精算済み",
                    method=["現金", "カード", "その他"][(j + offset) % 3],
                    paidBy=s,
                    paidAt=day + "T15:00:00+11:00",
                    confirmed=day + "T14:45:00+11:00",
                    signed=c["name"],
                    released=day + "T15:00:00+11:00",
                )
            elif offset == 0 and j == 0:
                b.update(
                    status="onsite",
                    arrival=day + "T08:00:00+11:00",
                    began=day + "T08:05:00+11:00",
                    final=240,
                )
            elif offset == 0 and j == 1:
                b["status"] = "enroute"
            b["messages"].append(
                dict(
                    at=b["issued"],
                    actor="OPS",
                    direction="送信",
                    subject="無料見積もりの受付",
                    body="ご依頼を受け付けました。当日の予約確認と到着予定をメールでご案内します。",
                    doc="",
                )
            )
            state["bookings"].append(b)
    record(state, "OPS", "デモ用データを用意")
    return state


def closed_company(state, day):
    weekday = date.fromisoformat(day).weekday()
    cfg = state["settings"]
    return weekday in cfg["weekly"] or day in cfg["holidays"]


def busy_interval(b):
    if b["status"] == "cancelled":
        return None
    begin = mins(b["start"])
    if b["released"]:
        released = datetime.fromisoformat(b["released"]).astimezone(ZONE)
        days = (released.date() - date.fromisoformat(b["date"])).days
        return begin, max(begin, days * 1440 + released.hour * 60 + released.minute)
    if b["status"] in {"done", "declined", "onsite", "enroute", "working"} and b["date"] == today():
        # The crew remains unavailable after the planned end until its release is recorded.
        return begin, 24 * 60
    return begin, begin + b["duration"]


def available(state, day, start, length, exclude=""):
    begin = mins(start)
    end = begin + length
    if closed_company(state, day) or begin < 8 * 60 or end > 18 * 60 or length <= 0:
        return [], []
    weekday = date.fromisoformat(day).weekday()
    staff = [
        s["id"]
        for s in state["staff"]
        if s["active"] and s.get("field", s["role"] != "管理者") and weekday not in s["off"]
    ]
    vehicles = [v["id"] for v in state["vehicles"] if v["active"]]
    busy_staff = set()
    busy_vehicles = set()
    for b in state["bookings"]:
        if b["date"] != day or b["id"] == exclude:
            continue
        interval = busy_interval(b)
        if interval and interval[0] < end and begin < interval[1]:
            busy_staff.add(b["staff"])
            busy_vehicles.add(b["vehicle"])
    for block in state["blocks"]:
        if block["date"] == day and mins(block["start"]) < end and begin < mins(block["end"]):
            busy_staff.add(block["staff"])
            busy_vehicles.add(block["vehicle"])
    return [s for s in staff if s not in busy_staff], [v for v in vehicles if v not in busy_vehicles]


def future_slot(day, start):
    return datetime.fromisoformat(day + "T" + start).replace(tzinfo=ZONE) >= datetime.now(ZONE)


def slot_rows(state, day, length, detailed=False):
    rows = []
    for at in range(8 * 60, 18 * 60, 30):
        start = clock(at)
        staff, cars = available(state, day, start, length)
        if staff and cars and future_slot(day, start):
            row = dict(start=start)
            if detailed:
                row.update(staff=staff, vehicles=cars)
            rows.append(row)
    return rows


def visible_token(b):
    if b["status"] == "cancelled":
        return False
    end = b["confirmed"] or (b["released"] if b["status"] == "declined" else "")
    return not end or datetime.now(ZONE) < datetime.fromisoformat(end) + timedelta(hours=48)
