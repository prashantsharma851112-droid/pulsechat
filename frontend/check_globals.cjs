const fs = require('fs');
const path = require('path');
const parser = require('./node_modules/@babel/parser');
const traverse = require('./node_modules/@babel/traverse').default;

const BROWSER_GLOBALS = new Set([
  'URLSearchParams', 'AbortController', 'createImageBitmap', 'OffscreenCanvas', 'OfflineAudioContext',
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB',
  'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'URL', 'Blob', 'File', 'FileReader', 'FormData', 'Headers',
  'Request', 'Response', 'WebSocket', 'Worker', 'Notification', 'Audio', 'Image',
  'crypto', 'SubtleCrypto', 'CryptoKey', 'TextEncoder', 'TextDecoder', 'atob', 'btoa',
  'console', 'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Symbol', 'Error', 'TypeError',
  'RangeError', 'SyntaxError', 'ReferenceError', 'URIError', 'EvalError', 'ArrayBuffer',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'Float32Array', 'Float64Array', 'DataView', 'Infinity', 'NaN', 'undefined', 'parseInt',
  'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'encodeURIComponent', 'decodeURI',
  'decodeURIComponent', 'alert', 'confirm', 'prompt', 'location', 'history', 'screen',
  'performance', 'CustomEvent', 'Event', 'MessageChannel', 'MessagePort', 'BroadcastChannel',
  'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'HTMLAudioElement',
  'HTMLVideoElement', 'HTMLCanvasElement', 'CanvasRenderingContext2D', 'AudioContext',
  'webkitAudioContext', 'MediaStream', 'MediaRecorder', 'SpeechRecognition',
  'webkitSpeechRecognition', 'SpeechSynthesisUtterance', 'speechSynthesis', 'navigator',
  'self', 'globalThis', 'caches', 'ServiceWorker', 'SharedWorker', 'EventSource',
  'RTCPeerConnection', 'RTCSessionDescription', 'RTCIceCandidate', 'process', 'import'
]);

function getAllFiles(dir, exts = ['.js', '.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        results = results.concat(getAllFiles(fullPath, exts));
      }
    } else {
      if (exts.includes(path.extname(file))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const files = getAllFiles(path.join(__dirname, 'src'));
console.log(`Checking ${files.length} frontend source files for undeclared identifiers...`);

let totalErrors = 0;

for (const filePath of files) {
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'exportDefaultFrom', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport']
    });
  } catch (err) {
    console.error(`PARSE ERROR in ${filePath}: ${err.message}`);
    totalErrors++;
    continue;
  }

  const undeclared = new Set();

  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      // Skip JSX tags (e.g. <div>) unless capital (React components)
      if (p.parent.type === 'JSXOpeningElement' && p.parent.name === p.node) {
        if (/^[a-z]/.test(name)) return;
      }
      // Skip property keys in MemberExpressions, ObjectProperties if not computed
      if (p.parent.type === 'MemberExpression' && p.parent.property === p.node && !p.parent.computed) {
        return;
      }
      if (p.parent.type === 'ObjectProperty' && p.parent.key === p.node && !p.parent.computed) {
        return;
      }
      // Check if binding exists in current scope
      if (!p.scope.hasBinding(name) && !BROWSER_GLOBALS.has(name)) {
        // Special Vite or common globals
        if (name === 'React' || name === 'THREE' || name === 'process' || name === 'global' || name === 'Buffer') return;
        undeclared.add(`${name} (line ${p.node.loc ? p.node.loc.start.line : 'unknown'})`);
      }
    }
  });

  if (undeclared.size > 0) {
    console.error(`\n[UNDECLARED IDENTIFIERS] in ${path.relative(__dirname, filePath)}:`);
    for (const item of undeclared) {
      console.error(`  - ${item}`);
    }
    totalErrors += undeclared.size;
  }
}

if (totalErrors === 0) {
  console.log('\n SUCCESS: 0 undeclared identifiers found across all frontend source files!');
} else {
  console.error(`\n FAILED: Found ${totalErrors} undeclared identifier references!`);
  process.exit(1);
}
