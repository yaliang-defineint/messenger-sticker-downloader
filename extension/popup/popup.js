document.addEventListener("DOMContentLoaded", () => {
  const formatWebp = document.getElementById("formatWebp");
  const formatGif = document.getElementById("formatGif");

  chrome.storage.sync.get(["downloadFormat"], (data) => {
    if (data.downloadFormat === "gif") {
      formatGif.checked = true;
    } else {
      formatWebp.checked = true;
    }
  });

  formatWebp.addEventListener("change", () => saveSetting("downloadFormat", "webp"));
  formatGif.addEventListener("change", () => saveSetting("downloadFormat", "gif"));

  function saveSetting(key, value) {
    chrome.storage.sync.set({ [key]: value });
  }
});