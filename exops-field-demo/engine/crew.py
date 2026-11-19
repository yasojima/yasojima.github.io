"""Dispatch summary using the same availability and bookings as the calendar."""

from datetime import datetime

from model import ZONE, available, closed_company, mins


# Fictional points for the public walk-through. No device sends data to this map.
SAMPLE_POINTS = {
    "S02": (-33.8834, 151.2125, "Surry Hills"),
    "S03": (-33.8651, 151.1915, "Pyrmont"),
    "S04": (-33.8984, 151.1771, "Newtown"),
}


def snapshot(state, user, instant=None):
    instant = instant or datetime.now(ZONE)
    day, clock = instant.date().isoformat(), instant.strftime("%H:%M")
    team = [s for s in state["staff"] if s["active"] and s.get("field", s["role"] != "管理者")
            and (user["role"] == "管理者" or s["id"] == user["id"])]
    bookings = sorted((b for b in state["bookings"] if b["date"] == day and b["status"] != "cancelled"
                       and (user["role"] == "管理者" or b["staff"] == user["id"])), key=lambda b: b["start"])
    free_team, free_cars = available(state, day, clock, 60)
    open_day = not closed_company(state, day)
    sample_at = next((entry["at"] for entry in reversed(state["logs"])
                      if entry["action"] == "デモ用データを用意"), "")
    rows = []
    for member in team:
        key = member["id"]
        jobs = [b for b in bookings if b["staff"] == key]
        scheduled = open_day and instant.weekday() not in member["off"]
        current = next((b for b in jobs if b["status"] in {"onsite", "working", "enroute"}), None)
        cleanup = next((b for b in jobs if b["status"] in {"done", "declined"} and
                        (not b["released"] or datetime.fromisoformat(b["released"]) > instant)), None)
        next_job = next((b for b in jobs if b["status"] == "booked"), None)
        block = any(x["staff"] == key and x["date"] == day and x["start"] <= clock < x["end"]
                    for x in state["blocks"])
        if current:
            status = "移動中" if current["status"] == "enroute" else "現場対応中"
        elif cleanup:
            status = "片付け・移動準備中"
        elif not scheduled or not 480 <= mins(clock) < 1080:
            status = "勤務外"
        elif block:
            status = "社内予定"
        elif next_job and next_job["start"] <= clock:
            status = "開始確認待ち"
        else:
            status = "待機中"
        ready = status == "待機中" and key in free_team and bool(free_cars)
        point = SAMPLE_POINTS.get(key)
        rows.append(dict(id=key, name=member["name"], nick=member["nick"], status=status,
                         scheduled=scheduled, ready=ready,
                         current=(current or cleanup or {}).get("id"), next=(next_job or {}).get("id"),
                         position={"lat": point[0], "lng": point[1], "area": point[2], "at": sample_at}
                         if point else None))
    return dict(day=day, staff=rows, reservations=len(bookings),
                completed=sum(b["status"] == "done" for b in bookings),
                scheduled=sum(r["scheduled"] for r in rows),
                onSite=sum(r["status"] == "現場対応中" for r in rows),
                ready=sum(r["ready"] for r in rows))
