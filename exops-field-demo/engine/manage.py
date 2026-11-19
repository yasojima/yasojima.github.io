"""Office administration for the local preview."""

import re
from model import available, by_id, ident, mins, now, record, today
from operations import admin, day_of, field, password_hash


def manage(state, user, d):
    action = field(d, "action")
    key = d.get("id", "")
    result = {}
    customer = ""
    if action == "view":
        if d.get("booking"):
            b = by_id(state["bookings"], d["booking"])
            record(state, user["id"], "予約の詳細を閲覧", b)
        else:
            c = by_id(state["customers"], key)
            record(state, user["id"], "顧客の情報を閲覧", customer=c["id"])
        return result
    if action == "signaturePreference":
        user["signature"] = bool(d.get("enabled"))
        record(state, user["id"], "自分のメール署名設定を更新")
        return result
    if action == "block":
        day = day_of(d)
        start = field(d, "start", 5)
        end = field(d, "end", 5)
        n = mins(end) - mins(start)
        sid = field(d, "staff")
        vid = field(d, "vehicle")
        if n <= 0 or mins(start) < 480 or mins(end) > 1080:
            raise ValueError("開始・終了時刻は営業時間内で指定してください。")
        related = d.get("related", "")
        if related:
            reservation = by_id(state["bookings"], related)
            if (
                reservation["status"] not in {"working", "onsite"}
                or reservation["date"] != day
                or reservation["staff"] != sid
                or reservation["vehicle"] != vid
            ):
                raise ValueError("関連付ける現場とスタッフ・車両・日付を合わせてください。")
        staff, cars = available(state, day, start, n, exclude=related)
        if sid not in staff or vid not in cars:
            raise ValueError("ほかの予定と重なります。日時・担当者・車両を確認してください。")
        state["blocks"].append(
            dict(
                id=ident("B"),
                date=day,
                start=start,
                end=end,
                staff=sid,
                vehicle=vid,
                reason=field(d, "reason", 100),
                related=related,
            )
        )
        label = "社内予定を登録"
    elif action == "unblock":
        item = by_id(state["blocks"], key)
        state["blocks"].remove(item)
        label = "社内予定を解除"
    elif action in {"customer", "deleteCustomer"}:
        admin(user)
        c = by_id(state["customers"], key)
        customer = c["id"]
        if action == "deleteCustomer":
            if any(
                b["customer"] == key and b["status"] not in {"cancelled", "done", "declined"}
                for b in state["bookings"]
            ):
                raise ValueError("進行中の予約があります。終了後に削除できます。")
            c.update(
                name="削除済み顧客",
                email="",
                phone="",
                address="",
                area="",
                memo="",
                tags=[],
                deleted=True,
            )
            label = "顧客名簿から削除"
        else:
            old = dict(c)
            c.update(
                {
                    k: field(d, k, 220, k in {"name", "email", "phone", "address"})
                    for k in ["name", "email", "phone", "address", "area", "gender"]
                }
            )
            c["memo"] = field(d, "memo", 3000, False)
            c["tags"] = [tag["id"] for tag in state["tags"] if tag["id"] in d.get("tags", [])]
            labels = {
                "name": "氏名",
                "email": "メールアドレス",
                "phone": "電話番号",
                "address": "住所",
                "area": "エリア",
                "gender": "性別",
                "memo": "メモ",
                "tags": "サブステータス",
            }
            edited = [title for key, title in labels.items() if old.get(key) != c.get(key)]
            label = "顧客情報を更新" + ("（" + "、".join(edited) + "）" if edited else "")
    elif action == "vehicle":
        admin(user)
        car = by_id(state["vehicles"], key) if key else dict(id=ident("V"), active=True)
        start = day_of(d, "start")
        due = day_of(d, "due")
        if due < start:
            raise ValueError("期限日は開始日以降を指定してください。")
        car.update(
            maker=field(d, "maker", 70),
            model=field(d, "model", 70),
            plate=field(d, "plate", 40),
            start=start,
            due=due,
            checked=day_of(d, "checked"),
            done=bool(d.get("done")),
        )
        if not key:
            state["vehicles"].append(car)
        result["id"] = car["id"]
        label = "車両情報・点検期限を保存"
    elif action in {"tag", "tagDelete", "tagMove"}:
        admin(user)
        tags = state["tags"]
        tag = by_id(tags, key) if key else dict(id=ident("T"))
        if action == "tag":
            name = field(d, "name", 32)
            color = field(d, "color", 7)
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", color) or any(
                t["name"] == name and t["id"] != key for t in tags
            ):
                raise ValueError("色またはステータス名を確認してください。")
            tag.update(name=name, color=color)
            if not key:
                tags.append(tag)
        elif action == "tagDelete":
            tags.remove(tag)
            for c in state["customers"]:
                c["tags"] = [i for i in c["tags"] if i != key]
        else:
            i = tags.index(tag)
            j = i + int(d.get("delta", 0))
            if 0 <= j < len(tags):
                tags[i], tags[j] = tags[j], tags[i]
        label = "顧客ステータスを更新"
    elif action == "company":
        admin(user)
        cfg = state["settings"]
        work = [int(i) for i in d.get("weekly", [])]
        dates = sorted(set(d.get("holidays", [])))
        if any(i not in range(7) for i in work) or len(dates) > 366:
            raise ValueError("休日を確認してください。")
        for value in dates:
            day_of({"date": value})
        cfg.update(
            company=field(d, "company", 100),
            sender=field(d, "sender", 150),
            phone=field(d, "phone", 40),
            address=field(d, "address"),
            url=field(d, "url", 250, False),
            provider=field(d, "provider", 70, False),
            review=field(d, "review", 300, False),
            weekly=work,
            holidays=dates,
        )
        label = "会社・受付日・接続先のデモ設定を更新"
    elif action in {"staff", "retire"}:
        admin(user)
        s = by_id(state["staff"], key) if key else dict(id=ident("S"), active=True)
        if action == "retire":
            if key in {"S01", "S02", user["id"]}:
                raise ValueError("体験用または使用中のアカウントです。")
            if any(
                b["staff"] == key
                and b["date"] >= today()
                and b["status"] not in {"done", "declined", "cancelled"}
                for b in state["bookings"]
            ):
                raise ValueError("担当予定が残っています。先に担当を変更してください。")
            s.update(active=False)
        else:
            login = field(d, "login", 64)
            if any(x["id"] != key and x["login"] == login for x in state["staff"]):
                raise ValueError("このログインIDは使用されています。")
            role = field(d, "role", 16)
            if role not in {"一般スタッフ", "管理者"} or key in {"S01", "S02"} and role != s["role"]:
                raise ValueError("この権限は指定できません。")
            pw = field(d, "password", 150, False)
            if (not key or pw) and len(pw) < 8:
                raise ValueError("パスワードは8文字以上で入力してください。")
            if pw:
                s["hash"] = password_hash(pw)
            days = [int(i) for i in d.get("off", [])]
            if any(i not in range(7) for i in days):
                raise ValueError("曜日を確認してください。")
            s.update(
                name=field(d, "name", 100),
                nick=field(d, "nick", 40),
                birthday=day_of(d, "birthday"),
                login=login,
                role=role,
                off=days,
                field=bool(d.get("field")),
            )
            if not key:
                state["staff"].append(s)
        label = "スタッフアカウントを更新"
    else:
        raise ValueError("この操作を利用できません。")
    record(state, user["id"], label, customer=customer)
    return result
