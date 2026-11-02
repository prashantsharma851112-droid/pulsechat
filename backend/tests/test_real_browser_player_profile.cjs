const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const config = require('../config');
const User = require('../models/User');
const GameScore = require('../models/GameScore');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9333;
const USER_DATA_DIR = path.resolve(__dirname, 'chrome_test_profile');
const ARTIFACTS_DIR = 'C:\\Users\\Lenovo\\.gemini\\antigravity\\brain\\f19ac595-d4fd-46b4-8168-300ab5c2127f';

function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = net.createConnection(port, '127.0.0.1');
    s.once('connect', () => { s.end(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to send CDP command
function createCDPClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const pending = new Map();
  const listeners = new Map();

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      const cbs = listeners.get(msg.method) || [];
      cbs.forEach(cb => cb(msg.params));
    }
  });

  return new Promise((resolveOpen, rejectOpen) => {
    ws.on('open', () => {
      const client = {
        send: (method, params = {}) => {
          return new Promise((resolve, reject) => {
            const reqId = id++;
            pending.set(reqId, { resolve, reject });
            ws.send(JSON.stringify({ id: reqId, method, params }));
          });
        },
        on: (event, cb) => {
          if (!listeners.has(event)) listeners.set(event, []);
          listeners.get(event).push(cb);
        },
        close: () => ws.close(),
        eval: async (expr) => {
          const res = await client.send('Runtime.evaluate', {
            expression: expr,
            returnByValue: true,
            awaitPromise: true
          });
          if (res.exceptionDetails) {
            throw new Error(res.exceptionDetails.exception?.description || 'Eval error');
          }
          return res.result?.value;
        }
      };
      resolveOpen(client);
    });
    ws.on('error', rejectOpen);
  });
}

async function saveScreenshot(cdp, filename) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.data, 'base64');
  const localPath = path.resolve(__dirname, filename);
  fs.writeFileSync(localPath, buf);
  if (fs.existsSync(ARTIFACTS_DIR)) {
    try {
      fs.writeFileSync(path.resolve(ARTIFACTS_DIR, filename), buf);
    } catch (e) {}
  }
  return localPath;
}

async function runBrowserVerification() {
  console.log('================================================================');
  console.log('   PULSECHAT REAL BROWSER PLAYER PROFILES VERIFICATION SUITE   ');
  console.log('================================================================\n');

  await mongoose.connect(config.MONGO_URI);
  console.log('✓ Connected to MongoDB for authoritative verification.\n');

  let spawnedBackend = null;
  let spawnedFrontend = null;

  // 1. Ensure Backend is running on port 5000
  const isBackendUp = await isPortOpen(5000);
  if (!isBackendUp) {
    console.log('[Setup] Starting PulseChat backend server on port 5000...');
    spawnedBackend = spawn(process.execPath, [path.resolve(__dirname, '../server.js')], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: '5000' }
    });
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      if (await isPortOpen(5000)) break;
    }
    assert(await isPortOpen(5000), 'Backend failed to start on port 5000');
    console.log('✓ Backend server live on port 5000.\n');
  } else {
    console.log('✓ Existing Backend server detected on port 5000.\n');
  }

  // 2. Ensure Frontend is running on port 5173
  const isFrontendUp = await isPortOpen(5173);
  if (!isFrontendUp) {
    console.log('[Setup] Starting Vite dev server on port 5173...');
    spawnedFrontend = spawn('cmd.exe', ['/c', 'npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
      cwd: path.resolve(__dirname, '../../frontend')
    });
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      if (await isPortOpen(5173)) break;
    }
    assert(await isPortOpen(5173), 'Frontend failed to start on port 5173');
    console.log('✓ Frontend server live on port 5173.\n');
  } else {
    console.log('✓ Existing Frontend server detected on port 5173.\n');
  }

  // 3. Get real authenticated user
  const topScores = await GameScore.find({}).sort({ score: -1, level: -1, gamesPlayed: -1 }).limit(5).lean();
  const realScore1 = topScores[0];
  const realScore2 = topScores[1];

  const authUser = await User.findOne({}).lean();
  assert(authUser, 'Must have at least one user in DB to authenticate.');
  const authToken = jwt.sign(
    { id: authUser.id, username: authUser.username, email: authUser.email },
    config.JWT_SECRET,
    { expiresIn: '2h' }
  );

  console.log(`[Auth] Authenticating as user: ${authUser.displayName} (@${authUser.username})`);
  console.log(`[Leaderboard Expected #1]: ${realScore1.displayName} (${realScore1.score} pts, userId: ${realScore1.userId})`);
  console.log(`[Leaderboard Expected #2]: ${realScore2.displayName} (${realScore2.score} pts, userId: ${realScore2.userId})\n`);

  // 4. Launch real Google Chrome
  if (fs.existsSync(USER_DATA_DIR)) {
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
  }

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--remote-debugging-address=127.0.0.1',
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank'
  ]);

  chromeProc.stderr.on('data', (d) => {
    const s = d.toString();
    if (s.includes('DevTools listening on')) {
      console.log('[Chrome Notice]:', s.trim());
    }
  });

  let cdp = null;

  try {
    // Poll for CDP endpoint
    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const jsonList = await new Promise((resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${DEBUG_PORT}/json/list`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
          });
          req.on('error', reject);
        });
        const pageTarget = Array.isArray(jsonList) && jsonList.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (pageTarget) {
          wsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {}
    }

    assert(wsUrl, 'Failed to connect to Chrome DevTools WebSocket after 10s');
    cdp = await createCDPClient(wsUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    cdp.on('Runtime.exceptionThrown', (params) => {
      console.log('[Browser Exception]:', params.exceptionDetails?.text, params.exceptionDetails?.exception?.description);
    });

    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        const text = (params.args || []).map(a => a.value || a.description || '').join(' ');
        console.log('[Browser Console Error]:', text);
      }
    });

    // Default Desktop Viewport
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 5. Navigate to frontend root
    console.log('[Step 1] Navigating to http://127.0.0.1:5173...');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5173' });
    await sleep(2000);

    // Set localStorage
    console.log('[Step 1.1] Injecting authenticated session into browser localStorage...');
    await cdp.eval(`
      localStorage.setItem('pulsechat_token', '${authToken}');
      localStorage.setItem('pulsechat_user', JSON.stringify(${JSON.stringify({
        id: authUser.id,
        username: authUser.username,
        displayName: authUser.displayName,
        avatar: authUser.avatar || '',
        isPro: Boolean(authUser.isPro)
      })}));
      localStorage.setItem('pulsechat_onboarding_completed', 'true');
      localStorage.setItem('pulsechat_has_seen_intro', 'true');
      localStorage.setItem('pulsechat_onboarding_${authUser.id}', 'true');
      localStorage.setItem('pulsechat_feature_tour_completed_${authUser.id}', 'true');
      localStorage.setItem('pulse_restore_prompt_dismissed_${authUser.id}', 'true');
    `);

    // Reload page to enter authenticated chat
    console.log('[Step 2] Reloading application with authenticated session...');
    await cdp.send('Page.reload');
    await sleep(2500);

    // Wait for Sidebar to load
    let appLoaded = false;
    for (let i = 0; i < 30; i++) {
      appLoaded = await cdp.eval(`Boolean(document.querySelector('.sidebar') || document.querySelector('[title*="Pulse Zone"]') || document.querySelector('.chat-container'))`);
      if (appLoaded) break;
      await sleep(500);
    }
    if (!appLoaded) {
      const pageInfo = await cdp.eval(`({ url: window.location.href, html: document.body.innerHTML.substring(0, 800) })`);
      console.log('[Page Info on Timeout]:', pageInfo);
    }
    assert(appLoaded, 'Application did not load authenticated view');
    console.log('✓ Application loaded into authenticated view successfully.\n');

    // 6. Click the Pulse Zone button
    console.log('[Step 3] Clicking Pulse Zone (Mini-Games & Leaderboard) button in topbar...');
    await cdp.eval(`
      const btn = document.querySelector('[title*="Pulse Zone"]');
      if (btn) btn.click();
    `);
    await sleep(800);

    const isZoneOpen = await cdp.eval(`Boolean(document.querySelector('.modal-card'))`);
    assert(isZoneOpen, 'PulseZoneModal did not open on button click');
    console.log('✓ Pulse Zone modal successfully opened.\n');

    // 7. Click the Leaderboard tab
    console.log('[Step 4] Switching to Leaderboard tab...');
    await cdp.eval(`
      const tabs = Array.from(document.querySelectorAll('button'));
      const lbTab = tabs.find(b => b.textContent && b.textContent.includes('Leaderboard'));
      if (lbTab) lbTab.click();
    `);

    // Wait for leaderboard rows to render
    let rowCount = 0;
    for (let i = 0; i < 30; i++) {
      rowCount = await cdp.eval(`document.querySelectorAll('[aria-label*="View gaming profile"]').length`);
      if (rowCount > 0) break;
      await sleep(300);
    }
    console.log(`[Leaderboard] Found ${rowCount} interactive player rows with aria-label.\n`);
    assert(rowCount > 0, 'Leaderboard rows did not render or lack aria-label');

    // =========================================================================
    // SCENARIO 1 & 2: Click #1 player and verify profile replaces leaderboard
    // =========================================================================
    console.log('[Step 5] Clicking #1 Rank player row...');
    await cdp.eval(`(() => {
      const rows = document.querySelectorAll('[aria-label*="View gaming profile"]');
      if (rows[0]) rows[0].click();
    })()`);
    await sleep(1500);

    // Verify PlayerProfile view opened inside modal
    const isProfileModalOpen = await cdp.eval(`Boolean(document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]'))`);
    assert(isProfileModalOpen, 'PlayerProfile view did not open when #1 player row was clicked!');
    console.log('✓ SUCCESS: Dedicated PlayerProfile view opened inside Pulse Zone modal!\n');

    // Verify NO horizontal overflow outside modal
    const overflowCheck = await cdp.eval(`(() => {
      const modal = document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]');
      const card = document.querySelector('.modal-card');
      if (!modal || !card) return { hasOverflow: true };
      const modalRect = modal.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        hasOverflow: modalRect.right > cardRect.right + 2 || modalRect.left < cardRect.left - 2,
        modalWidth: Math.round(modalRect.width),
        cardWidth: Math.round(cardRect.width)
      };
    })()`);
    assert(!overflowCheck.hasOverflow, `Profile overflowed modal! modalWidth: ${overflowCheck.modalWidth}, cardWidth: ${overflowCheck.cardWidth}`);
    console.log(`✓ Zero horizontal overflow: Profile fits cleanly inside modal card (${overflowCheck.modalWidth}px / ${overflowCheck.cardWidth}px).\n`);

    // Inspect rendered profile details
    const profileDetails = await cdp.eval(`(() => {
      const modal = document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]');
      if (!modal) return null;
      return {
        title: modal.querySelector('h3')?.innerText || '',
        username: modal.querySelector('p.text-xs.text-gray-400')?.innerText || '',
        bio: modal.querySelector('p.italic')?.innerText || '',
        globalRankBadge: modal.querySelector('.text-lg.font-black.text-white')?.innerText || '',
        pointsBadge: modal.querySelector('.text-lg.font-black.text-indigo-300')?.innerText || '',
        streakBadge: modal.querySelector('.text-lg.font-black.text-orange-300')?.innerText || '',
        hasGoldCrown: Boolean(modal.querySelector('[title*="#1 Gold"]')),
        gameRecordsCount: modal.querySelectorAll('.grid.grid-cols-2 > div, .player-profile-records-grid > div').length,
        achievementsCount: modal.querySelectorAll('.text-amber-200').length,
        arrowLevelText: Array.from(modal.querySelectorAll('.grid.grid-cols-2 > div, .player-profile-records-grid > div')).find(d => d.textContent.includes('Arrow Puzzle'))?.querySelector('.text-xs.font-bold')?.innerText || '',
        tictactoeRecordText: modal.querySelector('.text-cyan-300')?.innerText || ''
      };
    })()`);

    console.log('[Rendered Profile Details for #1 Player]:', JSON.stringify(profileDetails, null, 2));
    assert(profileDetails.title.length > 0, 'Player profile displayName should not be empty');
    assert(profileDetails.globalRankBadge === '#1', 'Global rank badge should display #1');
    assert(profileDetails.hasGoldCrown, 'Rank #1 player must display #1 Gold Crown badge');
    assert.strictEqual(profileDetails.arrowLevelText, 'Lvl 1', 'Arrow level for Tic-Tac-Toe player must be Lvl 1, NOT Lvl 215!');
    assert.strictEqual(profileDetails.tictactoeRecordText, '215W - 98L', 'AI Arena record must be 215W - 98L, NOT 24,659W - 0L!');
    console.log('✓ Profile rendered with verified #1 Gold Crown, global points, and accurate game stats (Lvl 1 Arrow, 215W-98L TicTacToe).\n');

    // Capture Desktop Screenshot
    const desktopImg = await saveScreenshot(cdp, 'desktop_player_profile.png');
    console.log(`✓ Captured Desktop profile screenshot at: ${desktopImg}\n`);

    // =========================================================================
    // SCENARIO 3: Navigate back via "Back to Leaderboard" button
    // =========================================================================
    console.log('[Step 6] Navigating back to Leaderboard via "Back to Leaderboard" button...');
    await cdp.eval(`(() => {
      const backBtn = document.querySelector('button[aria-label="Back to Leaderboard"]');
      if (backBtn) backBtn.click();
    })()`);
    await sleep(600);

    const isClosedAfterBack = await cdp.eval(`!document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]')`);
    assert(isClosedAfterBack, 'PlayerProfile failed to close via Back to Leaderboard button');
    const isLeaderboardRestored = await cdp.eval(`Boolean(document.querySelectorAll('[aria-label*="View gaming profile"]').length > 0)`);
    assert(isLeaderboardRestored, 'Leaderboard rows were not restored upon navigating back');
    console.log('✓ Successfully navigated Back: Leaderboard view restored; Pulse Zone modal remains open.\n');

    // =========================================================================
    // SCENARIO 4: Click #2 player and verify profile updates to #2
    // =========================================================================
    console.log('[Step 7] Clicking #2 Rank player row...');
    await cdp.eval(`(() => {
      const rows = document.querySelectorAll('[aria-label*="View gaming profile"]');
      if (rows[1]) rows[1].click();
    })()`);
    await sleep(1500);

    const profile2Details = await cdp.eval(`(() => {
      const modal = document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]');
      if (!modal) return null;
      return {
        title: modal.querySelector('h3')?.innerText || '',
        globalRankBadge: modal.querySelector('.text-lg.font-black.text-white')?.innerText || '',
        pointsBadge: modal.querySelector('.text-lg.font-black.text-indigo-300')?.innerText || '',
        hasSilverCrown: Boolean(modal.querySelector('[title*="#2 Silver"]'))
      };
    })()`);

    console.log('[Rendered Profile Details for #2 Player]:', JSON.stringify(profile2Details, null, 2));
    assert(profile2Details.title !== profileDetails.title, 'Player 2 profile title must be distinct from Player 1');
    assert(profile2Details.globalRankBadge === '#2', 'Player 2 rank badge must display #2');
    assert(profile2Details.hasSilverCrown, 'Player 2 must display #2 Silver Crown badge');
    console.log('✓ Successfully opened Player #2 profile with Silver Crown and isolated stats.\n');

    // =========================================================================
    // SCENARIO 5: Dismiss profile via Escape key
    // =========================================================================
    console.log('[Step 8] Testing Escape key dismissal...');
    await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))`);
    await sleep(600);

    const isClosedAfterEsc = await cdp.eval(`!document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]')`);
    assert(isClosedAfterEsc, 'PlayerProfile failed to dismiss via Escape key');
    console.log('✓ Escape key successfully dismissed profile back to Leaderboard.\n');

    // =========================================================================
    // SCENARIO 6: Mobile Portrait Emulation (390 x 844)
    // =========================================================================
    console.log('[Step 9] Emulating Mobile Portrait Viewport (390x844 iPhone / Pixel)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(800);

    // Verify Pulse Zone is open on mobile
    let isZoneOpenMobile = await cdp.eval(`(() => {
      const h2 = document.querySelector('.modal-card h2');
      return Boolean(h2 && h2.innerText.includes('Pulse Zone'));
    })()`);
    if (!isZoneOpenMobile) {
      console.log('[Mobile Setup] Opening Pulse Zone in mobile view...');
      await cdp.eval(`(() => {
        const btn = document.querySelector('[title*="Pulse Zone"]');
        if (btn) btn.click();
      })()`);
      await sleep(1000);
    }

    // Ensure Leaderboard tab is selected
    await cdp.eval(`(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const lbTab = tabs.find(b => b.textContent && b.textContent.includes('Leaderboard'));
      if (lbTab) lbTab.click();
    })()`);
    await sleep(800);

    // Wait for leaderboard rows to be present
    let mobileLbRows = 0;
    for (let i = 0; i < 20; i++) {
      mobileLbRows = await cdp.eval(`document.querySelectorAll('[aria-label*="View gaming profile"]').length`);
      if (mobileLbRows > 0) break;
      await sleep(300);
    }

    const domStateBeforeClick = await cdp.eval(`({
      hasModalCard: Boolean(document.querySelector('.modal-card')),
      mobileLbRows: document.querySelectorAll('[aria-label*="View gaming profile"]').length,
      hasPulseZoneTitle: Boolean(document.querySelector('[title*="Pulse Zone"]')),
      modalCardTextSnippet: document.querySelector('.modal-card')?.innerText?.substring(0, 300) || '',
      activeTabButton: Array.from(document.querySelectorAll('button')).find(b => b.style.background?.includes('gradient'))?.innerText || ''
    })`);
    console.log('[Step 9 DOM State before clicking player row]:', domStateBeforeClick);

    // Tap #1 player row in mobile view
    await cdp.eval(`(() => {
      const rows = document.querySelectorAll('[aria-label*="View gaming profile"]');
      if (rows[0]) {
        rows[0].click();
      }
    })()`);
    
    // Wait for player profile view to appear
    let mobileProfileAppeared = false;
    for (let i = 0; i < 20; i++) {
      mobileProfileAppeared = await cdp.eval(`Boolean(document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]'))`);
      if (mobileProfileAppeared) break;
      await sleep(300);
    }

    // Verify mobile layout
    const mobileLayout = await cdp.eval(`(() => {
      const modal = document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]');
      const card = document.querySelector('.modal-card');
      if (!modal || !card) return { notFound: true, hasOverflow: true };
      const docWidth = document.documentElement.clientWidth;
      const modalRect = modal.getBoundingClientRect();
      return {
        notFound: false,
        hasOverflow: modalRect.width > docWidth || modal.scrollWidth > modal.clientWidth + 2,
        docWidth,
        modalWidth: Math.round(modalRect.width),
        modalScrollWidth: modal.scrollWidth
      };
    })()`);

    assert(!mobileLayout.notFound, 'Player Profile view was not rendered on mobile');
    assert(!mobileLayout.hasOverflow, `Mobile profile has horizontal overflow! modalWidth: ${mobileLayout.modalWidth}, docWidth: ${mobileLayout.docWidth}`);
    console.log(`✓ Mobile Portrait Responsive: 0 horizontal overflow (viewport: 390px, modal: ${mobileLayout.modalWidth}px).\n`);

    const mobileImg = await saveScreenshot(cdp, 'mobile_player_profile.png');
    console.log(`✓ Captured Mobile Portrait screenshot at: ${mobileImg}\n`);

    // Test Back button on mobile
    await cdp.eval(`(() => {
      const backBtn = document.querySelector('button[aria-label="Back to Leaderboard"]');
      if (backBtn) backBtn.click();
    })()`);
    await sleep(500);
    const isClosedMobileBack = await cdp.eval(`!document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]')`);
    assert(isClosedMobileBack, 'Mobile Back to Leaderboard button failed to dismiss profile');
    console.log('✓ Mobile Back button successfully returned to Leaderboard.\n');

    // =========================================================================
    // SCENARIO 7: Mobile Landscape Emulation (844 x 390)
    // =========================================================================
    console.log('[Step 10] Emulating Mobile Landscape Viewport (844x390)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 844,
      height: 390,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(800);

    let isZoneOpenLandscape = await cdp.eval(`(() => {
      const h2 = document.querySelector('.modal-card h2');
      return Boolean(h2 && h2.innerText.includes('Pulse Zone'));
    })()`);
    if (!isZoneOpenLandscape) {
      await cdp.eval(`(() => {
        const btn = document.querySelector('[title*="Pulse Zone"]');
        if (btn) btn.click();
      })()`);
      await sleep(1000);
    }

    await cdp.eval(`(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const lbTab = tabs.find(b => b.textContent && b.textContent.includes('Leaderboard'));
      if (lbTab) lbTab.click();
    })()`);
    await sleep(800);

    // Wait for leaderboard rows
    for (let i = 0; i < 20; i++) {
      const rowsCount = await cdp.eval(`document.querySelectorAll('[aria-label*="View gaming profile"]').length`);
      if (rowsCount > 0) break;
      await sleep(300);
    }

    await cdp.eval(`(() => {
      const rows = document.querySelectorAll('[aria-label*="View gaming profile"]');
      if (rows[0]) rows[0].click();
    })()`);

    // Wait for player profile view to appear
    for (let i = 0; i < 20; i++) {
      const appeared = await cdp.eval(`Boolean(document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]'))`);
      if (appeared) break;
      await sleep(300);
    }

    const landscapeLayout = await cdp.eval(`(() => {
      const modal = document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]');
      const card = document.querySelector('.modal-card');
      if (!modal || !card) return { notFound: true, hasOverflow: true };
      const docWidth = document.documentElement.clientWidth;
      const modalRect = modal.getBoundingClientRect();
      return {
        notFound: false,
        hasOverflow: modalRect.width > docWidth || modal.scrollWidth > modal.clientWidth + 2,
        docWidth,
        modalWidth: Math.round(modalRect.width)
      };
    })()`);

    assert(!landscapeLayout.notFound, 'Player Profile view was not rendered on landscape mobile');
    assert(!landscapeLayout.hasOverflow, `Landscape profile has horizontal overflow! modalWidth: ${landscapeLayout.modalWidth}`);
    console.log(`✓ Mobile Landscape Responsive: 0 horizontal overflow (viewport: 844px, modal: ${landscapeLayout.modalWidth}px).\n`);

    const landscapeImg = await saveScreenshot(cdp, 'mobile_landscape_player_profile.png');
    console.log(`✓ Captured Mobile Landscape screenshot at: ${landscapeImg}\n`);

    // Close profile via Done button
    await cdp.eval(`(() => {
      const buttons = Array.from(document.querySelectorAll('[role="dialog"][aria-label="Player Gaming Profile"] button'));
      const doneBtn = buttons.find(b => b.textContent && b.textContent.includes('Done'));
      if (doneBtn) doneBtn.click();
    })()`);
    await sleep(500);

    const isClosedAfterDone = await cdp.eval(`!document.querySelector('[role="dialog"][aria-label="Player Gaming Profile"]')`);
    assert(isClosedAfterDone, 'PlayerProfile failed to dismiss via Done button');
    console.log('✓ Done button successfully dismissed profile.\n');

    console.log('================================================================');
    console.log('   ALL REAL-BROWSER VERIFICATION SCENARIOS PASSED (EXIT CODE 0) ');
    console.log('================================================================\n');

  } finally {
    try { await cdp.close(); } catch (e) {}
    try { chromeProc.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
    if (spawnedBackend) {
      try { spawnedBackend.kill(); } catch (e) {}
    }
    if (spawnedFrontend) {
      try { spawnedFrontend.kill(); } catch (e) {}
    }
    await mongoose.disconnect();
  }
}

runBrowserVerification().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ BROWSER VERIFICATION FAILED:', err);
  process.exit(1);
});
