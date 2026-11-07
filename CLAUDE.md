# kumishift 開発メモ

- 返答・コメント・ドキュメントは日本語で書く
- 画面（web/）は Next.js + React + TypeScript
- UI/UX は shadcn/ui（Tailwind CSS + Radix UI）を使う
- 入力フォームは React Hook Form + Zod で作る（バリデーションのスキーマは Zod で定義）
- シフト作成エンジンは Python + OR-Tools（src/kumishift）。画面からは API（FastAPI）経由で呼ぶ
