(function initSupabaseClient() {
  const url = window.__OGIRI_SUPABASE_URL__;
  const key = window.__OGIRI_SUPABASE_KEY__;
  if (!url || !key) {
    console.warn('Supabase URL / Key が未設定です。docs/config.js を編集してください。');
    return;
  }
  if (!window.supabase) {
    console.error('Supabase SDK が読み込めていません。CDN スクリプトを確認してください。');
    return;
  }
  window.__supabaseClient = window.supabase.createClient(url, key, {
    auth: { persistSession: false }
  });
})();
