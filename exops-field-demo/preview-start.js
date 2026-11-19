const scriptBase = new URL("./", import.meta.url);
try {
  if (!("serviceWorker" in navigator)) throw new Error("このブラウザでは操作デモを保存できません。");
  const script = new URL("preview-worker.js", scriptBase);
  await navigator.serviceWorker.register(script, {scope:scriptBase.href});
  await navigator.serviceWorker.ready;
  const isReady = () => navigator.serviceWorker.controller?.scriptURL === script.href;
  if (!isReady()) {
    await new Promise(resolve => {
      function check() {
        if (!isReady()) return;
        navigator.serviceWorker.removeEventListener("controllerchange", check);
        resolve();
      }
      navigator.serviceWorker.addEventListener("controllerchange", check);
      check();
    });
  }
  await import("./app.js");
} catch (error) {
  const message = document.querySelector("#root main");
  message.textContent = "デモを開けませんでした。通信を確認し、再読み込みしてください。";
  console.error(error);
}
