/**
 * Universal Client-Side Image Compressor & Resizer
 * Resizes images using offscreen canvas to ultra-lightweight JPEG/WebP.
 * Turns 8MB-15MB camera photos into ~20KB-40KB, uploading in milliseconds
 * and preventing HTML 413 Payload Too Large / DOCTYPE errors.
 */
export const compressImage = (file, maxWidth = 360, maxHeight = 360, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided'));
    }

    // If already a small SVG or tiny string
    if (typeof file === 'string' && file.startsWith('https://')) {
      return resolve(file);
    }

    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

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

          // High-quality downsampling smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to efficient JPEG
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
