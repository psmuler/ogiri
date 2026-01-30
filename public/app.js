const appEl = document.getElementById('app');

document.addEventListener('DOMContentLoaded', () => {
  route();
  window.addEventListener('popstate', route);
});

function route() {
  const path = window.location.pathname;
  if (path === '/') {
    renderHome();
    return;
  }
  if (path.startsWith('/prompt/')) {
    const parts = path.split('/').filter(Boolean);
    const promptId = parts[1];
    if (promptId) {
      renderPrompt(promptId);
      return;
    }
  }
  renderNotFound();
}

function renderHome() {
  const main = document.createElement('main');
  const header = document.createElement('header');
  header.innerHTML = `
    <h1>おてがる大喜利</h1>
    <p>「調整さん」感覚でURLを作って共有するだけ。スマホ一つでお題→回答→判定まで回せます。</p>
  `;

  const createCard = document.createElement('section');
  createCard.className = 'card';
  createCard.innerHTML = `
    <h2>お題を作る</h2>
    <form id="prompt-form">
      <label for="topic-input">お題</label>
      <textarea id="topic-input" name="topic" maxlength="140" placeholder="例：こんな調整さんは嫌だ。どんなの？" required></textarea>
      <button type="submit" id="create-btn">URLを発行する</button>
      <div class="error-message hidden" id="prompt-error"></div>
    </form>
    <div class="share-box hidden" id="share-box">
      <strong>お題ができました！</strong>
      <p id="share-topic"></p>
      <div class="link-row">
        <input type="text" readonly id="share-url" />
        <button type="button" class="secondary-btn" id="copy-share">コピー</button>
      </div>
      <small>このリンクをグループに貼れば、回答と判定の両方をおまかせできます。</small>
    </div>
  `;

  const howtoCard = document.createElement('section');
  howtoCard.className = 'card';
  howtoCard.innerHTML = `
    <h2>使い方</h2>
    <ul>
      <li>幹事がお題を入力し、URLを作って共有</li>
      <li>参加者は匿名でも何度でも回答OK</li>
      <li>「判定モード」でお題→回答→「おもろい / 普通」をタップするだけ</li>
    </ul>
  `;

  const footer = document.createElement('footer');
  footer.textContent = 'β版：フィードバックはなんでもどうぞ！';

  main.append(header, createCard, howtoCard, footer);
  appEl.replaceChildren(main);

  const form = createCard.querySelector('#prompt-form');
  const errorBox = createCard.querySelector('#prompt-error');
  const shareBox = createCard.querySelector('#share-box');
  const shareTopic = createCard.querySelector('#share-topic');
  const shareUrlInput = createCard.querySelector('#share-url');
  const copyBtn = createCard.querySelector('#copy-share');
  const button = createCard.querySelector('#create-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.classList.add('hidden');
    const topic = form.topic.value.trim();
    if (!topic) {
      errorBox.textContent = 'お題を入力してください。';
      errorBox.classList.remove('hidden');
      return;
    }
    button.disabled = true;
    button.textContent = '発行中...';
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || '発行に失敗しました。');
      }
      const prompt = payload.prompt;
      const shareUrl = `${window.location.origin}/prompt/${prompt.id}`;
      shareTopic.textContent = `お題：${prompt.topic}`;
      shareUrlInput.value = shareUrl;
      shareBox.classList.remove('hidden');
      shareBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      form.reset();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    } finally {
      button.disabled = false;
      button.textContent = 'URLを発行する';
    }
  });

  copyBtn.addEventListener('click', () => {
    const url = shareUrlInput.value;
    if (!url) return;
    copyToClipboard(url).then(() => {
      copyBtn.textContent = 'コピーしました';
      setTimeout(() => (copyBtn.textContent = 'コピー'), 1500);
    });
  });
}

async function renderPrompt(promptId) {
  const main = document.createElement('main');
  const loadingCard = document.createElement('section');
  loadingCard.className = 'card';
  loadingCard.textContent = 'お題を読み込み中...';
  main.appendChild(loadingCard);
  appEl.replaceChildren(main);

  try {
    const prompt = await fetchPrompt(promptId);
    buildPromptPage(main, prompt);
  } catch (err) {
    loadingCard.innerHTML = `
      <p>${err.message}</p>
      <p><a href="/">トップに戻る</a></p>
    `;
  }
}

function renderNotFound() {
  const main = document.createElement('main');
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = `
    <h2>ページが見つかりません</h2>
    <p>URLが間違っているか、削除された可能性があります。</p>
    <p><a href="/">お題を作り直す</a></p>
  `;
  main.appendChild(card);
  appEl.replaceChildren(main);
}

async function fetchPrompt(promptId) {
  const response = await fetch(`/api/prompts/${promptId}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'お題の取得に失敗しました。');
  }
  return payload.prompt;
}

function buildPromptPage(main, prompt) {
  main.innerHTML = '';

  const backLink = document.createElement('a');
  backLink.href = '/';
  backLink.textContent = '← お題を作る';
  backLink.className = 'back-link';

  const infoCard = document.createElement('section');
  infoCard.className = 'card';
  infoCard.innerHTML = `
    <p class="status-pill"><span id="answer-count">${prompt.answers.length}</span> 件の回答</p>
    <h2 class="prompt-title" id="prompt-title"></h2>
    <div class="share-box">
      <p>参加者にはこのURLをシェア</p>
      <div class="link-row">
        <input type="text" readonly id="share-url" value="${window.location.origin}/prompt/${prompt.id}" />
        <button type="button" class="secondary-btn" id="prompt-copy">コピー</button>
      </div>
      <small>回答と判定は同じページからできます。</small>
    </div>
  `;
  infoCard.querySelector('#prompt-title').textContent = prompt.topic;

  const answerCard = document.createElement('section');
  answerCard.className = 'card';
  answerCard.innerHTML = `
    <h3>回答する</h3>
    <form id="answer-form">
      <label for="answer-text">回答</label>
      <textarea id="answer-text" name="text" maxlength="200" placeholder="回答を入力" required></textarea>
      <label for="answer-name">名前（任意）</label>
      <input id="answer-name" name="author" maxlength="40" placeholder="匿名でもOK" />
      <button type="submit" id="answer-submit">投稿する</button>
    </form>
    <div id="answer-success" class="success-message hidden"></div>
    <div id="answer-error" class="error-message hidden"></div>
  `;

  const judgeCard = document.createElement('section');
  judgeCard.className = 'card judge-card';
  judgeCard.innerHTML = `
    <h3>判定モード</h3>
    <p class="alert">「お題のみ表示」→タップ→回答→「おもろい / 普通」を選ぶ流れで判定できます。</p>
    <button id="start-judge">判定をはじめる</button>
    <div id="judge-workspace" class="hidden">
      <div class="prompt-chip">お題</div>
      <p class="prompt-title" id="judge-prompt"></p>
      <div class="answer-panel" id="answer-panel">タップで回答を表示</div>
      <div class="judge-buttons hidden" id="judge-buttons">
        <button type="button" class="funny-btn" data-verdict="funny">おもろい</button>
        <button type="button" class="meh-btn" data-verdict="meh">普通</button>
      </div>
      <p class="progress-text" id="judge-progress"></p>
    </div>
    <div class="alert hidden" id="judge-empty">まだ回答がありません。URLをシェアしてもらいましょう。</div>
    <div class="success-message hidden" id="judge-finish">全ての回答を判定しました！</div>
  `;

  const footer = document.createElement('footer');
  footer.textContent = '保存はシンプルなファイルベースです。リロードで状況は更新されます。';

  main.append(backLink, infoCard, answerCard, judgeCard, footer);

  setupShareCopy(infoCard.querySelector('#prompt-copy'), infoCard.querySelector('#share-url'));
  setupAnswerForm(answerCard, prompt.id, () => renderPrompt(prompt.id));
  setupJudge(judgeCard, prompt);
}

function setupShareCopy(button, input) {
  button.addEventListener('click', () => {
    copyToClipboard(input.value).then(() => {
      button.textContent = 'コピーしました';
      setTimeout(() => (button.textContent = 'コピー'), 1500);
    });
  });
}

function setupAnswerForm(card, promptId, onSuccess) {
  const form = card.querySelector('#answer-form');
  const successBox = card.querySelector('#answer-success');
  const errorBox = card.querySelector('#answer-error');
  const submitBtn = card.querySelector('#answer-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    successBox.classList.add('hidden');
    errorBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = '投稿中...';
    const payload = {
      text: form.text.value.trim(),
      author: form.author.value.trim()
    };
    try {
      const response = await fetch(`/api/prompts/${promptId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '投稿に失敗しました。');
      }
      successBox.textContent = '投稿しました！ 追加の回答も歓迎です。';
      successBox.classList.remove('hidden');
      form.reset();
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '投稿する';
    }
  });
}

function setupJudge(judgeCard, prompt) {
  const startBtn = judgeCard.querySelector('#start-judge');
  const workspace = judgeCard.querySelector('#judge-workspace');
  const promptText = judgeCard.querySelector('#judge-prompt');
  const answerPanel = judgeCard.querySelector('#answer-panel');
  const judgeButtons = judgeCard.querySelector('#judge-buttons');
  const progress = judgeCard.querySelector('#judge-progress');
  const emptyAlert = judgeCard.querySelector('#judge-empty');
  const finishBox = judgeCard.querySelector('#judge-finish');

  promptText.textContent = prompt.topic;

  const state = {
    queue: [],
    current: null,
    judged: 0,
    total: prompt.answers.length,
    revealed: false
  };

  function updateProgress() {
    progress.textContent = state.total
      ? `${state.judged}/${state.total} 件 判定済み`
      : '判定対象がまだありません。';
  }

  function resetPanel() {
    state.revealed = false;
    judgeButtons.classList.add('hidden');
    answerPanel.classList.remove('revealed');
    answerPanel.textContent = 'タップで回答を表示';
  }

  function loadNext() {
    state.current = state.queue.shift() || null;
    resetPanel();
    finishBox.classList.add('hidden');
    if (!state.current) {
      workspace.classList.add('hidden');
      startBtn.textContent = 'もう一度判定する';
      startBtn.disabled = false;
      if (state.total === 0) {
        emptyAlert.classList.remove('hidden');
      } else if (state.judged === state.total) {
        finishBox.classList.remove('hidden');
      }
      updateProgress();
      return;
    }
    emptyAlert.classList.add('hidden');
    finishBox.classList.add('hidden');
    workspace.classList.remove('hidden');
    updateProgress();
  }

  answerPanel.addEventListener('click', () => {
    if (!state.current || state.revealed) return;
    state.revealed = true;
    answerPanel.classList.add('revealed');
    answerPanel.innerHTML = `
      <div>
        <div>${escapeHtml(state.current.text)}</div>
        <div style="margin-top:10px;font-size:0.85rem;color:#555;">${escapeHtml(state.current.author)}</div>
      </div>
    `;
    judgeButtons.classList.remove('hidden');
  });

  judgeButtons.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-verdict]');
    if (!button || !state.current) return;
    const verdict = button.dataset.verdict;
    judgeButtons.querySelectorAll('button').forEach((btn) => (btn.disabled = true));
    try {
      await fetch(`/api/prompts/${prompt.id}/judge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId: state.current.id, verdict })
      });
    } catch (err) {
      console.error(err);
    } finally {
      judgeButtons.querySelectorAll('button').forEach((btn) => (btn.disabled = false));
    }
    state.judged += 1;
    loadNext();
  });

  startBtn.addEventListener('click', () => {
    if (!prompt.answers.length) {
      emptyAlert.classList.remove('hidden');
      return;
    }
    state.queue = shuffle(prompt.answers.slice());
    state.total = state.queue.length;
    state.judged = 0;
    startBtn.textContent = '判定中...';
    startBtn.disabled = true;
    loadNext();
  });

  if (!prompt.answers.length) {
    emptyAlert.classList.remove('hidden');
  }
  updateProgress();
}

function shuffle(list) {
  const array = list.slice();
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  return Promise.resolve();
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (char) => (
    {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]
  ));
}
