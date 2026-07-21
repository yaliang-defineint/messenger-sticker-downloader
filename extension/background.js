chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "downloadStickerMenu",
    title: "下載此貼圖",
    contexts: ["all"],
    documentUrlPatterns: [
      "https://*.facebook.com/*",
      "https://*.messenger.com/*"
    ]
  });
});

async function setupOffscreenDocument(path) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(path)]
  });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['WORKERS', 'DOM_PARSER'],
    justification: 'GIF encoding requires Canvas API and Web Workers'
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "downloadStickerMenu" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "getStickerUrl" }, async (response) => {
      if (response && response.url) {
        
        const storage = await chrome.storage.sync.get(["downloadFormat"]);
        const format = storage.downloadFormat || "webp";
        
        console.log("準備處理貼圖:", response.url);
        await setupOffscreenDocument('assets/offscreen.html');

        chrome.runtime.sendMessage({
          target: 'offscreen',
          action: 'processSticker',
          url: response.url,
          format: format
        }, (result) => {
          if (result && result.success) {
            chrome.downloads.download({
              url: result.dataUrl,
              filename: `sticker_${Date.now()}.${result.finalExt}` 
            });
          } else {
             console.error("轉檔失敗:", result?.error);
          }
        });

      } else {
        console.warn("[Messenger Tools] 找不到貼圖網址。");
      }
    });
  }
});