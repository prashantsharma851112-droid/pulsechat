/**
 * Universal Client-Side Image Compressor & Resizer
 * Resizes images using offscreen canvas to ultra-lightweight JPEG/WebP.
 * Turns 8MB-15MB camera photos into ~20KB-40KB, uploading in milliseconds
 * and preventing HTML 413 Payload Too Large / DOCTYPE errors.
 */
export const compressImage = async (file, maxWidth = 360, maxHeight = 360, quality = 0.82) => {
  if (!file) {
    throw new Error('No file provided');
  }

  // If already a small SVG or remote string
  if (typeof file === 'string' && (file.startsWith('https://') || file.startsWith('data:image/svg'))) {
    return file;
  }

  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  // Yield to UI thread first so modal opening/touch ripple remains instant
  await new Promise((r) => setTimeout(r, 0));

  // 1. Off-thread decoding via createImageBitmap when supported
  if (typeof createImageBitmap === 'function' && (file instanceof File || file instanceof Blob)) {
    try {
      const bitmap = await createImageBitmap(file);
      let width = bitmap.width;
      let height = bitmap.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      if (typeof OffscreenCanvas !== 'undefined') {
        try {
          const offCanvas = new OffscreenCanvas(width, height);
          const ctx = offCanvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, width, height);
            if (typeof offCanvas.convertToBlob === 'function') {
              const blob = await offCanvas.convertToBlob({ type: 'image/jpeg', quality });
              if (blob) {
                if (typeof bitmap.close === 'function') bitmap.close();
                return await new Promise((res) => {
                  const reader = new FileReader();
                  reader.onloadend = () => res(reader.result);
                  reader.readAsDataURL(blob);
                });
              }
            }
          }
        } catch (offErr) {}
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);
        if (typeof bitmap.close === 'function') bitmap.close();
        return canvas.toDataURL('image/jpeg', quality);
      }
    } catch (bitmapErr) {
      // Fallback to Image() pipeline below
    }
  }

  // 2. Standard Resilient Image() pipeline
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Keep aspect ratio within maxWidth and maxHeight
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(e.target.result); // Fallback to raw if canvas unsupported
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          console.warn('Canvas compression error, falling back to original:', err);
          resolve(e.target.result);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to decode image. Please choose another photo.'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file from your device.'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Safe JSON parser that prevents SyntaxError: Unexpected token '<' (HTML DOCTYPE error)
 */
export const parseSafeJson = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    if (!res.ok) {
      if (res.status === 413) {
        throw new Error('Image size is too large. Please select a smaller photo.');
      }
      if (res.status === 502 || res.status === 504) {
        throw new Error('Server temporarily busy. Please try again in a few seconds.');
      }
      throw new Error(`Server returned error (${res.status}). Please try again.`);
    }
    throw new Error('Invalid response format from server.');
  }
};
