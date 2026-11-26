(() => {
  "use strict";

  const statusText = {
    signed: "署名済み", active: "有効", draft: "下書き", sent: "送信済み",
    expiring: "期限間近", renewed: "更新済み", expired: "期限切れ",
    cancelled: "解約", canceled: "解約", completed: "完了",
  };
  const format = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short",
  });

  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className || "";
    if (text != null) element.textContent = text;
    return element;
  }

  function displayDate(timestamp) {
    const date = new Date(timestamp);
    return timestamp && !Number.isNaN(date.getTime()) ? format.format(date) : "記録なし";
  }

  function addMetadata(container, label, value) {
    const row = node("div", "sk-contract-meta-item");
    row.append(node("dt", "", label), node("dd", "", value));
    container.append(row);
  }

  function review(contract, openPdf, terms) {
    const panel = node("section", "sk-contract-review");
    if (!contract) {
      panel.append(node("p", "sk-contract-empty", "該当する契約がありません。"));
      return panel;
    }

    const header = node("header", "sk-contract-review-head");
    const heading = node("div");
    heading.append(
      node("p", "sk-contract-number", contract.number),
      node("h2", "", terms[contract.title] || contract.title || "契約書")
    );
    if (contract.customer) heading.append(node("p", "sk-contract-muted", contract.customer));
    const pdf = node("button", "sk-contract-open", "契約PDFを開く");
    pdf.type = "button";
    pdf.disabled = !contract.pdf;
    if (contract.pdf) pdf.addEventListener("click", () => openPdf({
      filename: (contract.number || "契約書") + ".pdf",
      data: contract.pdf,
      pages: contract.pages
    }));
    header.append(heading, pdf);
    panel.append(header);
    if (!contract.pdf) {
      panel.append(node(
        "p", "sk-contract-empty",
        contract.pdfUnavailable || "この契約には元デモの閲覧画面にPDFを開く操作がありません。"
      ));
    }

    const signature = contract.signature || {};
    const details = node("div", "sk-contract-signature");
    details.append(node("h3", "", "署名情報"));
    const metadata = node("dl", "sk-contract-meta");
    addMetadata(metadata, "契約状態", statusText[contract.status] || terms[contract.status] || contract.status);
    const signedAt = signature.signedAt;
    addMetadata(metadata, "署名日時（日本時間）", displayDate(signedAt));
    if (signature.signer) addMetadata(metadata, "署名者", signature.signer);
    if (signature.companySignedAt) addMetadata(metadata, "会社側の署名日時", displayDate(signature.companySignedAt));
    if (signature.status && signature.status !== contract.status) {
      addMetadata(metadata, "署名状態", statusText[signature.status] || terms[signature.status] || signature.status);
    }
    addMetadata(metadata, "署名画像", signature.signatureImage ? "あり" : "元デモで表示なし");
    if (signature.certificateAvailable === false) addMetadata(metadata, "署名証明書", "元デモで表示なし");
    details.append(metadata);
    if (signature.signatureImage) {
      const image = node("img", "sk-contract-signature-image");
      image.src = signature.signatureImage;
      image.alt = "契約の署名画像";
      details.append(image);
    }
    panel.append(details);
    return panel;
  }

  window.mountContractWorkspace = (root, { data, links, terms = {}, openPdf }) => {
    const contracts = data.contracts;
    const screen = node("div", "sk-contract");
    const header = node("header", "sk-contract-header");
    const back = node("a", "sk-contract-back", "← 契約管理へ");
    back.href = links["/contracts/"];
    header.append(
      back,
      node("h1", "", "契約PDF・署名情報"),
      node("p", "sk-contract-muted", "ServiceLifeの顧客対応ロールで収録した契約 · " + displayDate(data.capturedAt) + "（日本時間）")
    );
    screen.append(header);

    const columns = node("div", "sk-contract-grid");
    const catalog = node("section", "sk-contract-catalog");
    const controls = node("div", "sk-contract-controls");
    const label = node("label", "", "契約番号・契約名");
    const search = node("input");
    search.type = "search";
    search.id = "sk-contract-search";
    search.autocomplete = "off";
    label.htmlFor = search.id;
    const pdfLabel = node("label", "sk-contract-pdf-label");
    const pdfOnly = node("input");
    pdfOnly.type = "checkbox";
    pdfOnly.id = "sk-contract-pdf-only";
    pdfLabel.append(pdfOnly, document.createTextNode("PDFを閲覧できる契約のみ"));
    const summary = node("p", "sk-contract-muted");
    summary.setAttribute("aria-live", "polite");
    controls.append(label, search, pdfLabel, summary);
    const list = node("ul", "sk-contract-list");
    catalog.append(controls, list);
    const target = node("div", "sk-contract-detail");
    columns.append(catalog, target);
    screen.append(columns);
    root.replaceChildren(screen);

    let selected = contracts.find(contract => contract.pdf)?.id || contracts[0]?.id;
    function update() {
      const term = search.value.trim().toLocaleLowerCase();
      const view = contracts.filter(contract =>
        (!pdfOnly.checked || contract.pdf) &&
        [contract.number, contract.title, terms[contract.title], contract.customer].some(
          value => String(value || "").toLocaleLowerCase().includes(term)
        )
      );
      if (!view.some(contract => contract.id === selected)) selected = view[0]?.id;
      summary.textContent = view.length + "件 · PDFあり " + view.filter(contract => contract.pdf).length + "件";
      list.replaceChildren(...view.map(contract => {
        const item = node("li");
        const button = node("button", "sk-contract-row");
        button.type = "button";
        button.setAttribute("aria-pressed", String(selected === contract.id));
        button.dataset.contractId = contract.id;
        button.append(
          node("span", "sk-contract-number", contract.number),
          node("strong", "", terms[contract.title] || contract.title || "契約書"),
          node("span", "sk-contract-muted", [statusText[contract.status] || contract.status, contract.pdf && "PDFあり"].filter(Boolean).join(" · "))
        );
        button.addEventListener("click", () => {
          selected = contract.id;
          for (const row of list.querySelectorAll("button")) row.setAttribute("aria-pressed", String(row === button));
          target.replaceChildren(review(contract, openPdf, terms));
        });
        item.append(button);
        return item;
      }));
      target.replaceChildren(review(view.find(contract => contract.id === selected), openPdf, terms));
    }

    search.addEventListener("input", update);
    pdfOnly.addEventListener("change", update);
    update();
  };
})();
