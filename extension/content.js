console.log("Messenger 貼圖下載器已成功載入！");

let lastRightClickedElement = null;

document.addEventListener("contextmenu", (event) => {
  lastRightClickedElement = event.target;
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getClickedStickerUrl") {
    if (!lastRightClickedElement) {
      sendResponse({ url: null });
      return;
    }

    const stickerDiv = lastRightClickedElement.closest('div[style*="background-image"]');
    if (stickerDiv) {
      const style = stickerDiv.getAttribute('style');
      const match = style.match(/url\(['"]?((?:blob:)?https?:\/\/[^'"]+)['"]?\)/);
      if (match && match[1]) {
        let imageUrl = match[1].replace(/&amp;/g, '&');
        sendResponse({ url: imageUrl });
        return;
      }
    }
    sendResponse({ url: null });
  }

  if (request.action === "executeDownload") {
    const { binaryData, mimeType, filename } = request;
    console.log(`[前端下載] 正在下載: ${filename} (${mimeType})`);

    // 1. 將陣列轉回 Uint8Array，再包裝成 Blob
    const uint8Array = new Uint8Array(binaryData);
    const blob = new Blob([uint8Array], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = filename;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // 3. 釋放記憶體
    URL.revokeObjectURL(blobUrl);
    console.log("下載完畢！");
  }
});