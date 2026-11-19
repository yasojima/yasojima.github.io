// This worker handles only this demo's API; the uploaded site contains no shared database.
const runtime = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
importScripts(runtime + "pyodide.js", runtime + "pyodide.asm.js");
const scopeRoot = self.registration.scope;
const apiRoot = new URL("api/", scopeRoot).href;
let runtimeReady;
let pending = Promise.resolve();

function sync(fs, fromStorage) {
  return new Promise((resolve, reject) => fs.syncfs(fromStorage, error => error ? reject(error) : resolve()));
}

async function startRuntime() {
  const py = await loadPyodide({ indexURL: runtime });
  await py.loadPackage(["sqlite3", "hashlib", "tzdata"]);
  const storage = "/exops-field-demo-data-v1";
  py.FS.mkdirTree(storage);
  py.FS.mount(py.FS.filesystems.IDBFS, {}, storage);
  await sync(py.FS, true);
  const modules = ["model", "operations", "manage", "documents", "crew", "server", "browser_server"];
  await Promise.all(modules.map(async name => {
    const response = await fetch(new URL("engine/" + name + ".py?v=9b934106d946a943", scopeRoot));
    if (!response.ok) throw new Error("予約データの処理を読み込めませんでした。");
    py.FS.writeFile("/home/pyodide/" + name + ".py", await response.text());
  }));
  const dispatch = py.runPython("from browser_server import dispatch\ndispatch");
  await sync(py.FS, false);
  return {py, dispatch};
}

async function handleApi(request) {
  try {
    runtimeReady ??= startRuntime().catch(error => { runtimeReady = null; throw error; });
    const {py, dispatch} = await runtimeReady;
    const url = request.url.slice(apiRoot.length);
    const result = JSON.parse(dispatch(request.method, url, request.method === "POST" ? await request.text() : ""));
    if (result.persist) {
      try { await sync(py.FS, false); }
      catch (error) { runtimeReady = null; throw error; }
    }
    const bytes = Uint8Array.from(atob(result.body), ch => ch.charCodeAt(0));
    return new Response(bytes, {status: result.status, headers: {
      "Content-Type": result.ctype, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
    }});
  } catch (error) {
    console.error("EXOPS preview", error);
    return Response.json({error: "デモを読み込めませんでした。通信とブラウザのサイトデータ設定を確認し、再読み込みしてください。"}, {status:503});
  }
}

self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (!event.request.url.startsWith(apiRoot)) return;
  const result = pending.then(() => handleApi(event.request));
  pending = result.catch(() => {});
  event.respondWith(result);
});
