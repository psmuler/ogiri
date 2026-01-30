# おてがる大喜利 (Chouseisan風)

GitHub Pages などの静的ホスティングで公開できる大喜利 SPA です。お題・回答データは Supabase (PostgreSQL + API) に保存します。

## ディレクトリ構成

- `docs/` — フロントエンド (ハッシュルーティング SPA)。`config.js` で Supabase の URL/Key を設定します。
- `server.js` / `storage.js` — ローカル検証用の簡易 Node サーバー (Supabase を使わずファイル保存)。

## フロントエンドの公開手順

1. `docs/config.js` に Supabase Project URL と anon key を記入します。
2. 必要なら `window.__OGIRI_SHARE_BASE__` で共有リンク用のベース URL を上書きします。
3. `docs/` 配下のファイルを GitHub Pages (例: `gh-pages` ブランチ、もしくは main ブランチの `/docs` ディレクトリ公開設定) にアップロードします。
4. 完成した URL の末尾に `/#/prompt/{お題ID}` を付ければ直接判定ページを共有できます。

## Supabase セットアップ

1. 新規プロジェクトを作成し、SQL Editor で以下を実行してテーブルを準備します。

```sql
create table public.prompts (
  id text primary key,
  topic text not null,
  created_at timestamptz not null default now()
);

create table public.answers (
  id text primary key,
  prompt_id text not null references public.prompts(id) on delete cascade,
  text text not null,
  author text not null default '匿名',
  created_at timestamptz not null default now(),
  votes_funny integer not null default 0,
  votes_meh integer not null default 0
);

create index answers_prompt_id_idx on public.answers(prompt_id);
```

2. Row Level Security を有効化し、匿名ユーザーを許可するポリシーを追加します (最低限以下の例)。

```sql
alter table public.prompts enable row level security;
alter table public.answers enable row level security;

create policy "anon insert prompts"
  on public.prompts for insert
  with check (true);

create policy "anon select prompts"
  on public.prompts for select
  using (true);

create policy "anon insert answers"
  on public.answers for insert
  with check (true);

create policy "anon select answers"
  on public.answers for select
  using (true);

create policy "anon update answers"
  on public.answers for update
  using (true)
  with check (true);
```

3. `Project Settings > API` から Project URL と anon 公開鍵をコピーし、`docs/config.js` に貼り付けます。
4. Supabase 側の Storage や Auth は不要です。匿名アクセスのみで完結します。

## ローカルでの動作確認 (任意)

Supabase を触らずに雰囲気だけ確認したい場合は簡易サーバーを使えます。

```sh
npm install
npm start
```

`server.js` は `data.json` に書き込むだけなので、本番用には Supabase を使ってください。
