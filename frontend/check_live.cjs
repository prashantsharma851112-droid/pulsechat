const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function checkLive() {
  console.log('====================================================');
  console.log('      PULSECHAT LIVE PRODUCTION HEALTH CHECK         ');
  console.log('====================================================');

  try {
    const fe = await fetchUrl('https://pulsechat-ten-theta.vercel.app');
    const bundleMatch = fe.body.match(/assets\/index-[^.]+\.js/);
    console.log(`[FRONTEND VERCEL] Status: ${fe.statusCode} OK`);
    console.log(`                 Live Bundle: ${bundleMatch ? bundleMatch[0] : 'Unknown'}`);
  } catch (err) {
    console.error(`[FRONTEND VERCEL] FAILED:`, err.message);
  }

  try {
    const be = await fetchUrl('https://pulsechat-api-v2.onrender.com/api/health');
    console.log(`[BACKEND RENDER]  Status: ${be.statusCode}`);
    console.log(`                 Payload: ${be.body}`);
  } catch (err) {
    console.error(`[BACKEND RENDER]  FAILED:`, err.message);
  }

  console.log('====================================================\n');
}

checkLive();
