import { BACKEND_URL } from './config';

/**
 * Robust Multi-Tier Live Translation Engine
 * Tier 1: PulseChat Backend Proxy (/api/messages/translate)
 * Tier 2: Direct Google GTX Translation (Sub-100ms ultra-fast endpoint)
 * Tier 3: MyMemory API Fallback
 */
export async function executeTranslation(text, targetLang = 'hi', token = null) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return null;
  }
  const clean = text.trim();

  // Tier 1: Backend proxy endpoint
  if (BACKEND_URL) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/messages/translate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: clean, targetLang })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.translatedText) {
          return {
            translatedText: data.translatedText,
            sourceLang: data.sourceLang || 'auto',
            targetLang
          };
        }
      }
    } catch (backendErr) {
      console.warn('Backend translate proxy failed, trying direct GTX fallback:', backendErr);
    }
  }

  // Tier 2: Direct Google Translate GTX Free Endpoint
  try {
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(clean)}`;
    const gtxRes = await fetch(gtxUrl);
    if (gtxRes.ok) {
      const gtxData = await gtxRes.json();
      if (Array.isArray(gtxData) && Array.isArray(gtxData[0])) {
        const translatedText = gtxData[0].map(item => item[0]).join('');
        const detectedSource = gtxData[2] || 'auto';
        if (translatedText) {
          return {
            translatedText,
            sourceLang: detectedSource,
            targetLang
          };
        }
      }
    }
  } catch (gtxErr) {
    console.warn('Direct GTX translate failed, trying MyMemory fallback:', gtxErr);
  }

  // Tier 3: MyMemory Free API
  try {
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=autodetect|${encodeURIComponent(targetLang)}`;
    const mmRes = await fetch(mmUrl);
    if (mmRes.ok) {
      const mmData = await mmRes.json();
      if (mmData?.responseData?.translatedText) {
        return {
          translatedText: mmData.responseData.translatedText,
          sourceLang: 'auto',
          targetLang
        };
      }
    }
  } catch (mmErr) {
    console.warn('Direct MyMemory translate failed:', mmErr);
  }

  return null;
}
