const appEl = document.getElementById('app');
const SHARE_BASE_OVERRIDE = window.__OGIRI_SHARE_BASE__ || '';

document.addEventListener('DOMContentLoaded', () => {
  route();
  window.addEventListener('hashchange', route);
});

function route() {
  const hashPath = window.location.hash.replace(/^#/, '');
  if (!hashPath && window.location.pathname.startsWith('/prompt/')) {
    window.location.replace(`#${window.location.pathname}`);
    return;
  }
  const path = normalizePath(hashPath || '/');
  if (path === '/' || path === '') {
    renderHome();
    return;
  }
  if (path.startsWith('/prompt/')) {
    const [, , promptId] = path.split('/');
    if (promptId) {
      renderPrompt(promptId);
      return;
    }
  }
  renderNotFound();
}

function normalizePath(path) {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function renderHome() {
  const main = document.createElement('main');
  const header = document.createElement('header');
  header.innerHTML = `
    <h1>おてがる大喜利</h1>
    <p>「調整さん」みたいにURLを作って貼るだけ。スマホだけでお題→回答→判定が回せます。</p>
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
      <small>このリンクをグループに貼れば回答も判定も同じ場所で遊べます。</small>
    </div>
  `;

  const howtoCard = document.createElement('section');
  howtoCard.className = 'card';
  howtoCard.innerHTML = `
    <h2>使い方</h2>
    <ul>
      <li>幹事がお題を入力してURLを発行</li>
      <li>URLを貼れば参加者は匿名でも好きなだけ回答可能</li>
      <li>「判定モード」でお題→回答→「おもろい / 普通」をタップ</li>
    </ul>
  `;

  const footer = document.createElement('footer');
  footer.textContent = 'β版です。Supabase に保存しています。';

  main.append(header, createCard, howtoCard, footer);
  appEl.replaceChildren(main);

  const supabaseReady = ensureSupabaseConfigured();
  if (!supabaseReady) {
    const warning = document.createElement('p');
    warning.className = 'error-message';
    warning.textContent = 'Supabase の URL / anon key が未設定です。docs/config.js を編集してください。';
    createCard.appendChild(warning);
    createCard.querySelector('form').classList.add('hidden');
    return;
  }

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
      const prompt = await createPrompt(topic);
      shareTopic.textContent = `お題：${prompt.topic}`;
      shareUrlInput.value = getShareUrl(prompt.id);
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

  if (!ensureSupabaseConfigured()) {
    loadingCard.innerHTML = `
      <p>Supabase の設定が未入力です。docs/config.js を編集してください。</p>
      <p><a href="#/">トップに戻る</a></p>
    `;
    return;
  }

  try {
    const prompt = await fetchPrompt(promptId);
    buildPromptPage(main, prompt);
  } catch (err) {
    loadingCard.innerHTML = `
      <p>${err.message}</p>
      <p><a href="#/">トップに戻る</a></p>
    `;
  }
}

function renderNotFound() {
  const main = document.createElement('main');
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = `
    <h2>ページが見つかりません</h2>
    <p>URLが間違っているか、公開準備中の可能性があります。</p>
    <p><a href="#/">お題を作り直す</a></p>
  `;
  main.appendChild(card);
  appEl.replaceChildren(main);
}

async function createPrompt(topic) {
  const client = getSupabaseClient();
  const id = generateId(6);
  const { data, error } = await client
    .from('prompts')
    .insert({ id, topic })
    .select('id, topic, created_at')
    .single();
  if (error) {
    console.error(error);
    throw new Error('お題の作成に失敗しました。');
  }
  return { id: data.id, topic: data.topic, createdAt: data.created_at, answers: [] };
}

async function fetchPrompt(promptId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('prompts')
    .select(
      `id, topic, created_at,
      answers:answers(id, text, author, created_at, votes_funny, votes_meh)`
    )
    .eq('id', promptId)
    .single();
  if (error) {
    console.error(error);
    throw new Error('お題が見つかりません。');
  }
  return {
    id: data.id,
    topic: data.topic,
    createdAt: data.created_at,
    answers: (data.answers || [])
      .map(mapAnswer)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  };
}

async function submitAnswer(promptId, payload) {
  const client = getSupabaseClient();
  const answerId = generateId(8);
  const { data, error } = await client
    .from('answers')
    .insert({
      id: answerId,
      prompt_id: promptId,
      text: payload.text,
      author: payload.author || '匿名'
    })
    .select('id, text, author, created_at, votes_funny, votes_meh')
    .single();
  if (error) {
    console.error(error);
    throw new Error('回答の投稿に失敗しました。');
  }
  return mapAnswer(data);
}

async function recordVerdict(promptId, answerId, verdict) {
  const client = getSupabaseClient();
  const { data: current, error: fetchError } = await client
    .from('answers')
    .select('id, votes_funny, votes_meh')
    .eq('id', answerId)
    .eq('prompt_id', promptId)
    .single();
  if (fetchError || !current) {
    console.error(fetchError);
    throw new Error('該当する回答がありません。');
  }
  const update = verdict === 'funny'
    ? { votes_funny: (current.votes_funny || 0) + 1 }
    : { votes_meh: (current.votes_meh || 0) + 1 };
  const { data, error } = await client
    .from('answers')
    .update(update)
    .eq('id', answerId)
    .eq('prompt_id', promptId)
    .select('id, text, author, created_at, votes_funny, votes_meh')
    .single();
  if (error) {
    console.error(error);
    throw new Error('判定の保存に失敗しました。');
  }
  return mapAnswer(data);
}

function buildPromptPage(main, prompt) {
  main.innerHTML = '';

  const backLink = document.createElement('a');
  backLink.href = '#/';
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
        <input type="text" readonly id="share-url" />
        <button type="button" class="secondary-btn" id="prompt-copy">コピー</button>
      </div>
      <small>回答と判定は同じページからできます。</small>
    </div>
  `;
  infoCard.querySelector('#prompt-title').textContent = prompt.topic;
  infoCard.querySelector('#share-url').value = getShareUrl(prompt.id);

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
    <p class="alert">「お題のみ表示」→タップ→回答を見る→「おもろい / 普通」を選んで次へ進みます。</p>
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
    <div class="alert hidden" id="judge-empty">まだ回答がありません。URLをシェアして参加者を集めましょう。</div>
    <div class="success-message hidden" id="judge-finish">全ての回答を判定しました！</div>
  `;

  const footer = document.createElement('footer');
  footer.textContent = 'Supabase に保存。リロードで最新の回答を取得できます。';

  main.append(backLink, infoCard, answerCard, judgeCard, footer);

  setupShareCopy(infoCard.querySelector('#prompt-copy'), infoCard.querySelector('#share-url'));
  setupAnswerForm(answerCard, prompt.id, () => renderPrompt(prompt.id));
  setupJudge(judgeCard, prompt);
}

function setupShareCopy(button, input) {
  button.addEventListener('click', () => {
    if (!input.value) return;
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
    if (!payload.text) {
      errorBox.textContent = '回答を入力してください。';
      errorBox.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = '投稿する';
      return;
    }
    try {
      await submitAnswer(promptId, payload);
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
      await recordVerdict(prompt.id, state.current.id, verdict);
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

function mapAnswer(item) {
  return {
    id: item.id,
    text: item.text,
    author: item.author,
    createdAt: item.created_at,
    votes: {
      funny: item.votes_funny || 0,
      meh: item.votes_meh || 0
    }
  };
}

function getSupabaseClient() {
  const client = window.__supabaseClient;
  if (!client) {
    throw new Error('Supabase が初期化されていません。');
  }
  return client;
}

function ensureSupabaseConfigured() {
  return Boolean(window.__supabaseClient);
}

function getShareUrl(promptId) {
  let base = SHARE_BASE_OVERRIDE;
  if (!base) {
    const { origin, pathname } = window.location;
    let derivedPath = pathname.replace(/index\.html$/, '');
    if (!derivedPath.endsWith('/')) {
      derivedPath += '/';
    }
    base = `${origin}${derivedPath}`;
  }
  if (!base.endsWith('/')) {
    base += '/';
  }
  return `${base}#/prompt/${promptId}`;
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

function generateId(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i += 1) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
