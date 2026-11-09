const status = document.getElementById("status");
const exit = document.getElementById("exit");
async function render() {
  const { state } = await chrome.storage.session.get("state");
  const active = Boolean(state && state.active);
  status.textContent = active
    ? `Deep Focus is on. Other sites are blocked (allowed: ${state.host}).`
    : "Deep Focus is off. It turns on by itself when you start studying in EdNova.";
  exit.hidden = !active;
}
exit.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "exit" });
  render();
});
render();
