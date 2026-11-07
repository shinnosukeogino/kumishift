# kumishift 開発メモ

- 返答・コメント・ドキュメントは日本語で書く
- 画面（web/）は Next.js + React + TypeScript
- UI/UX は shadcn/ui（Tailwind CSS + Radix UI）を使う
- 入力フォームは React Hook Form + Zod で作る（バリデーションのスキーマは Zod で定義）
- シフト作成エンジンは Python + OR-Tools（src/kumishift）。画面からは API（FastAPI）経由で呼ぶ
- shadcn/ui の部品は web/src/components/ui/ にある公式版（new-york-v4）。部品のファイルは書き換えず、色などは使う側の className で付ける
- 部品の追加・更新は `cd web && npx shadcn@latest add <名前>` で行う
- 画面の文言・エラーメッセージは日本語。Zod のエラーメッセージも日本語で書く
- web/AGENTS.md のとおり、Next.js は新しい版なので node_modules/next/dist/docs/ を確認してから書く
