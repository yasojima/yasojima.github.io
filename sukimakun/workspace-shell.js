function startSukimakunWorkspace(config) {
  const app = document.querySelector(".sk-shell");
  const menu = document.querySelector(".sk-shell-menu-button");
  const nav = document.querySelector(".sk-shell-nav");
  const role = document.querySelector(".sk-shell-role select");
  const root = document.querySelector(".sk-shell-main");
  const host = new URL(config.base);

  function send(type, payload = {}) {
    parent.postMessage({ application: "servicelife-jp", type, ...payload }, host.origin);
  }

  function setMenu(open) {
    app.toggleAttribute("data-menu-open", open);
    menu.setAttribute("aria-expanded", String(open));
    if (open) nav.querySelector("a[aria-current], a")?.focus();
    else menu.focus();
  }

  menu.addEventListener("click", () => setMenu(!app.hasAttribute("data-menu-open")));
  document.querySelector(".sk-shell-shade").addEventListener("click", () => setMenu(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && app.hasAttribute("data-menu-open")) setMenu(false);
  });
  document.querySelector(".sk-shell-signout").addEventListener("click", () => {
    alert("確認用デモのため、実際のログアウトは行いません。");
  });
  role.addEventListener("change", () => send("workspace-role", { role: role.value }));

  document.addEventListener("click", event => {
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.hasAttribute("download") || anchor.target === "_blank") return;
    const target = new URL(anchor.href, config.base);
    if (target.origin !== host.origin || target.pathname !== host.pathname) return;
    const route = target.hash.match(/^#(?:(?:company_admin|csr|technician))?(\/.*)$/);
    if (!route) return;
    event.preventDefault();
    send("route", { url: route[1] });
  });

  if (config.route === "/routes/") mountRouteWorkspace(root, config);
  else mountServiceWorkspace(root, config);
}
