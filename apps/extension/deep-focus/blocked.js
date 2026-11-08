document.getElementById("back").addEventListener("click", () => chrome.runtime.sendMessage({ type: "back" }));
document.getElementById("exit").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "exit" });
  history.length > 1 ? history.back() : window.close();
});
