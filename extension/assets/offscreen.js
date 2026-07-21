function detectRealExtension(arrayBuffer) {
  const arr = new Uint8Array(arrayBuffer).subarray(0, 12);
  let header = "";
  for (let i = 0; i < arr.length; i++) {
    header += arr[i].toString(16).padStart(2, '0').toUpperCase();
  }
  
  if (header.startsWith("89504E47")) return { ext: "png", mime: "image/png" };
  if (header.startsWith("47494638")) return { ext: "gif", mime: "image/gif" };
  if (header.startsWith("FFD8FF")) return { ext: "jpg", mime: "image/jpeg" };
  if (header.startsWith("52494646") && header.endsWith("57454250")) {
    return { ext: "webp", mime: "image/webp" };
  }
  
  return { ext: "webp", mime: "image/webp" };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return false;

  if (msg.action === 'processSticker') {
    convertProcess(msg.url, msg.format)
      .then(result => sendResponse({ success: true, dataUrl: result.dataUrl, finalExt: result.finalExt }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; 
  }
});

async function convertProcess(url, targetFormat) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();

  const { ext, mime } = detectRealExtension(buffer);

  if (targetFormat !== 'gif' || ext !== 'webp') {
    const blob = new Blob([buffer], { type: mime });
    const dataUrl = await blobToDataURL(blob);
    return { dataUrl, finalExt: ext }; 
  }

  const decoder = new ImageDecoder({ data: buffer, type: 'image/webp' });
  await decoder.tracks.ready;
  const track = decoder.tracks.selectedTrack;

  const frames = [];
  for (let i = 0; i < track.frameCount; i++) {
    const frame = await decoder.decode({ frameIndex: i });
    frames.push(frame.image);
  }

  if (frames.length === 0) throw new Error("解析不到任何影格");

  const width = frames[0].displayWidth;
  const height = frames[0].displayHeight;

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,           
      quality: 1,           
      width: width,
      height: height,
      workerScript: 'gif.worker.js',
      transparent: 'rgba(0,0,0,0)' 
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    for (const frame of frames) {
       ctx.clearRect(0, 0, width, height);
       ctx.drawImage(frame, 0, 0);

       const imgData = ctx.getImageData(0, 0, width, height);
       const data = imgData.data;
       for (let i = 0; i < data.length; i += 4) {
         if (data[i + 3] < 128) { 
           data[i + 3] = 0; 
           data[i] = 0; data[i+1] = 0; data[i+2] = 0; 
         } else {
           data[i + 3] = 255; 
         }
       }
       ctx.putImageData(imgData, 0, 0);

       const delay = frame.duration ? frame.duration / 1000 : 100;
       gif.addFrame(ctx, { delay: delay, copy: true });
       frame.close(); 
    }

    gif.on('finished', (blob) => {
      blobToDataURL(blob).then(dataUrl => {
        resolve({ dataUrl, finalExt: 'gif' });
      });
    });

    gif.on('abort', () => reject(new Error("轉檔遭強制中斷")));
    gif.render(); 
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}