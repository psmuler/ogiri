const http = require('http');
const fs = require('fs');
const path = require('path');
const storage = require('./storage');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'docs');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

function sendJSON(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  const safeSuffix = path.normalize(urlPath).replace(/^\.\/+/, '');
  const filePath = path.join(PUBLIC_DIR, safeSuffix);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

function handleApi(req, res, urlObj) {
  const segments = urlObj.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'api' || segments[1] !== 'prompts') {
    sendJSON(res, 404, { error: 'Not found' });
    return;
  }

  if (req.method === 'POST' && segments.length === 2) {
    return readBody(req)
      .then((body) => {
        const topic = (body?.topic || '').trim();
        if (!topic) {
          return sendJSON(res, 400, { error: 'お題を入力してください。' });
        }
        if (topic.length > 140) {
          return sendJSON(res, 400, { error: 'お題は140文字以内でお願いします。' });
        }
        const prompt = storage.createPrompt(topic);
        return sendJSON(res, 201, { prompt });
      })
      .catch((err) => {
        console.error(err);
        sendJSON(res, 400, { error: 'JSONの読み込みに失敗しました。' });
      });
  }

  if (segments.length >= 3) {
    const promptId = segments[2];
    const prompt = storage.getPrompt(promptId);
    if (!prompt) {
      sendJSON(res, 404, { error: 'お題が見つかりません。' });
      return;
    }

    if (req.method === 'GET' && segments.length === 3) {
      sendJSON(res, 200, { prompt });
      return;
    }

    if (req.method === 'POST' && segments.length === 4 && segments[3] === 'answers') {
      return readBody(req)
        .then((body) => {
          const text = (body?.text || '').trim();
          const author = (body?.author || '').trim();
          if (!text) {
            return sendJSON(res, 400, { error: '回答を入力してください。' });
          }
          if (text.length > 200) {
            return sendJSON(res, 400, { error: '回答は200文字以内でお願いします。' });
          }
          if (author.length > 40) {
            return sendJSON(res, 400, { error: '名前は40文字以内にしてください。' });
          }
          const answer = storage.addAnswer(promptId, { author, text });
          if (!answer) {
            return sendJSON(res, 404, { error: '回答の追加に失敗しました。' });
          }
          return sendJSON(res, 201, { answer });
        })
        .catch((err) => {
          console.error(err);
          sendJSON(res, 400, { error: 'JSONの読み込みに失敗しました。' });
        });
    }

    if (req.method === 'POST' && segments.length === 4 && segments[3] === 'judge') {
      return readBody(req)
        .then((body) => {
          const answerId = body?.answerId;
          const verdict = body?.verdict;
          if (!answerId || !verdict) {
            return sendJSON(res, 400, { error: '判定情報が不足しています。' });
          }
          const answer = storage.recordVerdict(promptId, answerId, verdict);
          if (!answer) {
            return sendJSON(res, 404, { error: '該当する回答がありません。' });
          }
          return sendJSON(res, 200, { answer });
        })
        .catch((err) => {
          console.error(err);
          sendJSON(res, 400, { error: 'JSONの読み込みに失敗しました。' });
        });
    }
  }

  sendJSON(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (urlObj.pathname.startsWith('/api/')) {
    handleApi(req, res, urlObj);
    return;
  }

  const served = serveStatic(req, res, urlObj.pathname === '/' ? '/index.html' : urlObj.pathname);
  if (!served) {
    // SPA fallback
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

server.listen(PORT, () => {
  console.log(`ogiri server listening on http://localhost:${PORT}`);
});
