# kumishift web

kumishift の画面（Next.js + TypeScript + shadcn/ui）です。使い方はリポジトリ直下の [README](../README.md) を見てください。

```bash
npm install
npm run dev        # http://localhost:3000
```

シフトの計算は API（`kumishift serve`、初期設定は http://127.0.0.1:8000 ）で行います。
別の場所で動かすときは `KUMISHIFT_API_URL` を設定してください。

## 構成

| 場所 | 内容 |
| --- | --- |
| `src/app/` | ページ（`/` シフト表、`/requests` シフト入力、`/settings` 設定） |
| `src/components/ui/` | shadcn/ui の公式部品（`npx shadcn@latest add <名前>` で追加・更新） |
| `src/components/settings/` など | 画面ごとの部品（フォームは React Hook Form + Zod） |
| `src/lib/schema.ts` | 入力データの Zod スキーマ（バリデーションとエラーメッセージ） |
| `src/lib/store.ts` | データの保存（ブラウザの localStorage） |
| `src/lib/to-config.ts` | 画面のデータ → エンジンの設定 JSON への変換 |
