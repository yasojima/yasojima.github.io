"""One-page Japanese PDF, using the standard PDF Japanese CID font collection."""

import textwrap


def make_pdf(doc):
    parts = []

    def line(x, y, text, size=12):
        encoded = str(text).encode("utf-16-be").hex()
        parts.append(f"BT /F1 {size} Tf 1 0 0 1 {x} {y} Tm <{encoded}> Tj ET")

    parts.extend(["0.09 0.30 0.21 rg", "42 777 511 5 re f"])
    line(42, 729, doc["kind"], 30)
    line(42, 698, doc["company"], 14)
    line(42, 671, doc["office"] + "　" + doc["phone"], 10)
    line(42, 635, doc["name"] + " 様", 19)
    line(42, 610, "発行日 " + doc["at"][:10] + "　／　受付番号 " + doc["booking"], 11)
    line(42, 565, "サービス内容", 11)
    line(42, 538, doc["service"], 17)
    line(42, 502, "訪問先 " + doc["address"][:57], 10)
    parts.extend(["0.90 0.95 0.92 rg", "42 390 511 73 re f", "0.09 0.30 0.21 rg"])
    line(58, 435, "概算金額" if doc["kind"] == "見積書" else "確定金額")
    line(58, 405, "AUD {:,.2f}".format(doc["amount"]), 22)
    tax = doc.get("tax")
    line(42, 372, "うち税額　" + ("AUD {:,.2f}".format(tax) if tax is not None else "未指定"), 10)
    line(42, 347, "ご案内", 12)
    body = doc["note"] or (
        "お送りいただいた資料に基づく概算です。現地確認のうえ料金をご案内します。"
        if doc["kind"] == "見積書"
        else "ご利用ありがとうございます。ご確認のうえお手続きください。"
    )
    for i, text in enumerate(textwrap.wrap(body, width=40)[:8]):
        line(42, 332 - 17 * i, text, 10)
    if doc.get("signed"):
        line(42, 166, "お客様確認 " + doc["signed"], 12)
    line(42, 87, "お問い合わせ " + doc["sender"], 10)
    line(42, 53, "EXOPS 操作デモ　サンプル帳票", 9)
    stream = "\n".join(parts).encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 6 0 R >>",
        b"<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiKakuGo-W5 /Encoding /UniJIS-UCS2-H /DescendantFonts [5 0 R] >>",
        b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiKakuGo-W5 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 5 >> /DW 1000 /W [1 95 550] >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for n, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{n} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for address in offsets[1:]:
        output.extend(f"{address:010d} 00000 n \n".encode())
    output.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(output)
