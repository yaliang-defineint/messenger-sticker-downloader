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

const stickerCache = new Map();

function detectRealExtension(arrayBuffer) {
  const arr = new Uint8Array(arrayBuffer).subarray(0, 12);
  let header = "";
  for (let i = 0; i < arr.length; i++) {
    header += arr[i].toString(16).padStart(2, '0').toUpperCase();
  }
  if (header.startsWith("89504E47")) return "png";
  if (header.startsWith("47494638")) return "gif";
  
  const isRiff = header.startsWith("52494646");
  const isWebp = header.substring(16, 24) === "57454250";
  if (isRiff && isWebp) return "webp";
  if (header.startsWith("FFD8FF")) return "jpg";
  return "png";
}

function getCleanUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'blob:') return url;
    return parsed.origin + parsed.pathname;
  } catch (e) {
    return url;
  }
}

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    if (details.url.includes("fbcdn.net") && (details.type === "image" || details.type === "xmlhttprequest")) {
      const cleanUrl = getCleanUrl(details.url);
      
      if (stickerCache.has(cleanUrl)) return;

      try {
        const res = await fetch(details.url, { cache: 'force-cache' });
        const arrayBuffer = await res.arrayBuffer();
        
        const extension = detectRealExtension(arrayBuffer);
        let mimeType = 'image/png';
        if (extension === 'webp') mimeType = 'image/webp';
        if (extension === 'gif') mimeType = 'image/gif';
        if (extension === 'jpg') mimeType = 'image/jpeg';

        stickerCache.set(cleanUrl, {
          arrayBuffer: arrayBuffer,
          extension: extension,
          mimeType: mimeType
        });
        
        console.log(`[網路攔截成功] 快取貼圖: ${cleanUrl} (真實格式: ${extension})`);
        
        if (stickerCache.size > 50) {
          const firstKey = stickerCache.keys().next().value;
          stickerCache.delete(firstKey);
        }
      } catch (e) {
        // 失敗
      }
    }
  },
  { urls: ["https://*.fbcdn.net/*"] }
);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "downloadStickerMenu" && tab.id) {
    
    chrome.tabs.sendMessage(tab.id, { action: "getClickedStickerUrl" }, async (response) => {
      if (response && response.url) {
        const stickerUrl = response.url;
        const cleanUrl = getCleanUrl(stickerUrl);
        
        console.log("正在檢索快取中的貼圖:", cleanUrl);

        let extension = 'png';
        let mimeType = 'image/png';
        let finalArrayBuffer = null;

        if (stickerCache.has(cleanUrl)) {
          console.log("成功擊中網路快取！直接提取最原始動態二進位。");
          const cached = stickerCache.get(cleanUrl);
          finalArrayBuffer = cached.arrayBuffer;
          extension = cached.extension;
          mimeType = cached.mimeType;
        } else {
          console.log("未擊中快取，嘗試直接下載並動態解析...");
          try {
            const res = await fetch(stickerUrl);
            finalArrayBuffer = await res.arrayBuffer();
            extension = detectRealExtension(finalArrayBuffer);
            
            if (extension === 'webp') mimeType = 'image/webp';
            if (extension === 'gif') mimeType = 'image/gif';
            if (extension === 'jpg') mimeType = 'image/jpeg';
            if (extension === 'png') mimeType = 'image/png';

            stickerCache.set(cleanUrl, {
              arrayBuffer: finalArrayBuffer,
              extension: extension,
              mimeType: mimeType
            });
            console.log(`[動態快取成功] ${cleanUrl} -> ${extension}`);

          } catch (e) {
            console.error("Fallback 下載失敗:", e);
            return;
          }
        }

        if (finalArrayBuffer) {
          const uint8Array = new Uint8Array(finalArrayBuffer);
          const binaryArray = Array.from(uint8Array);
          const filename = `capoo_sticker_${Date.now()}.${extension}`;

          chrome.tabs.sendMessage(tab.id, {
            action: "executeDownload",
            binaryData: binaryArray,
            mimeType: mimeType,
            filename: filename
          });
        }
      } else {
        console.warn("[下載失敗] 無法取得有效的貼圖網址。");
      }
    });
  }
});