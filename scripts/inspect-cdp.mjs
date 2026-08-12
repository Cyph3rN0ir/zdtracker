const port = process.argv[2];
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find((item) => item.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
const result = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Runtime did not respond in 5s")), 5000);
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id !== 1) return;
    clearTimeout(timeout);
    resolve(message);
  });
});
ws.send(JSON.stringify({
  id: 1,
  method: "Runtime.evaluate",
  params: {
    expression: "({ body: document.body.innerText, ready: document.readyState, url: location.href, now: performance.now() })",
    returnByValue: true,
  },
}));
console.log(JSON.stringify(await result, null, 2));
ws.close();
setTimeout(() => process.exit(0), 50);
