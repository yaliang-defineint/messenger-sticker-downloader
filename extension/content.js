console.log("[Messenger Sticker Downloader] 下載器已載入！");

let lastRightClickedElement = null;

document.addEventListener("contextmenu", (event) => {
  lastRightClickedElement = event.target;
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStickerUrl") {
    if (!lastRightClickedElement) {
      sendResponse({ url: null });
      return;
    }

    const stickerDiv = lastRightClickedElement.closest('div[style*="background-image"]');
    if (!stickerDiv) {
      sendResponse({ url: null });
      return;
    }

    const style = stickerDiv.getAttribute('style');
    const match = style.match(/url\(['"]?((?:blob:)?https?:\/\/[^'"]+)['"]?\)/);
    
    if (match && match[1]) {
      sendResponse({ url: match[1].replace(/&amp;/g, '&') });
    } else {
      sendResponse({ url: null });
    }
  }
});