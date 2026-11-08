# 開発メモ（引き継ぎ用）

別の作業セッションや別の開発者が、続きからすぐ作業できるようにまとめたメモです。
ルールは [CLAUDE.md](../CLAUDE.md)、使い方は [README](../README.md) を見てください。

最終更新: 2026-11-08

## いまの状態

| 部分 | 状態 |
| --- | --- |
| エンジン（`src/kumishift/`） | 勤務パターンモード・時間帯モード（営業時間・中休み）、休憩、固定（手で直した勤務）まで完成。テスト 36 件 |
| API（`src/kumishift/api.py`） | `POST /api/solve`、`GET /api/health` |
| 画面（`web/`） | 設定・シフト入力・シフト表（月間・カレンダー・日別・集計）、編集、印刷、書き出し（PNG・ics・CSV）、バックアップまで完成 |
| 公開 | https://github.com/shinnosukeogino/kumishift （Public、MIT、GitHub Actions でテスト・ビルド） |

## 次にやること（候補）

優先度の高い順。目安の時間つき。

1. **画面側のテスト（Vitest）** 約30分 — `lib/to-config.ts`・`lib/apply-fixes.ts`・`lib/remap-staff.ts`・`lib/export.ts`・`lib/backup.ts` の単体テスト。CI の web ジョブに追加する
2. **README にスクリーンショット** 約15分 — `docs/images/` に置いて README から参照
3. シフト表を画面上でドラッグして時間を直す
4. スタッフ本人がスマホから希望を出せる画面
5. データをサーバーに保存（複数人・複数店舗）
6. Excel / CSV からの入力、業種別テンプレート、開店前・閉店後の準備時間

## 構成とデータの流れ

```
web（ブラウザ）                          API / エンジン（Python）
 設定・スタッフ・シフト入力
   └ localStorage に保存（lib/store.ts）
 「シフトを作成」
   └ lib/to-config.ts で設定 JSON に変換 ──POST /api/solve──▶ model.parse_problem → solver.solve（OR-Tools CP-SAT）
 結果（ViewData）を月ごとに保存   ◀──────────────────────── html.to_view_data
   └ lib/remap-staff.ts（名前 → いまのスタッフ）
   └ lib/apply-fixes.ts（手で直した内容を重ねる）
   └ 月間・カレンダー・日別・印刷・書き出し
```

- `web/next.config.ts` の rewrites で `/api/*` を `KUMISHIFT_API_URL`（初期値 `http://127.0.0.1:8000`）に転送している
- 設定 JSON の形は README の「設定ファイルの書き方」と同じ（CLI の YAML と共通）

## 仕様の決めごと（理由つき）

- **時間帯モードの人数の数え方**: 時間の区切り（`step_minutes`）ごとに、その枠の最初から最後までいる人だけ数える。10:15 から入った人は 10 時台に数えない（計算を軽くするため。手で直すときは 15 分単位で入れられる）
- **中休み**: 中休みをまたぐ勤務は作らない。中休みの時間は必要人数を数えない
- **休憩**: `rules.breaks`（例: 6時間超 45分、8時間超 60分）で勤務時間から差し引く。休憩の時間帯は決めない。週の上限・合計時間・平等化は実働で数える
- **固定（手で直した勤務）**: エンジンの `type: 固定 / 固定休み`。スタッフの条件・希望より優先する。連勤・週の上限などと合わないと「解なし」→ API が「手で直した勤務が…」と返す
- **作成済みシフトとスタッフ**: エンジンは名前で結果を返すので、作成時の「名前 → ID」を `SolveResult.staffIds` に残し、表示のときにいまの名前に合わせる（名前変更・追加・削除に対応）
- **「条件が変わりました」の判定**: 手で直した内容は含めない（直すとすぐ表示に反映されるため）。直した内容の変化は別に `fixesKey` で見る
- **人数不足でも解なしにしない**: 不足は重いペナルティ（`weights.shortage`）にして、結果に不足の枠を出す
- **平等化**: `fair: true` の人どうしで出勤日数・土日祝の回数・合計時間の差を小さくする。短時間のアルバイトは `fair: false` を勧める
- **時間帯の色**: 勤務の開始時刻で決める（設定 → 表示）。最初の時刻より前に始まる勤務は最後の時間帯の色
- **ics の UID**: `スタッフID-日付@kumishift`。取り込み直すと同じ予定が更新される

## 保存データの版（web）

`lib/store.ts` の `STORE_VERSION` と `migrateState`。項目を足したら版を上げて移行処理を書く。バックアップの読み込みも同じ移行処理を通る。

| 版 | 追加したもの |
| --- | --- |
| 1 | 最初の版 |
| 2 | 中休み（`breakFrom/breakTo`）、休憩のルール、手で直した勤務（`fixes`） |
| 3 | 時間帯の色（`display`）、スタッフのアイコン（`icon`） |

## 作業のやり方

### 確認

```bash
python -m pytest -q                         # エンジンと API
cd web && npm run typecheck && npm run lint && npm run build
```

画面の確認は、API（`kumishift serve`）と `npm run start` を起動して、Playwright などで実際に操作する。印刷は `page.pdf()` で A4 横 1 枚に収まるか確認する。

### 持ち主のパソコン（Windows）

- ローカルの場所: `C:\Users\owner\Documents\work\kumishift\kumishift`
- `setup.bat`（最初の 1 回）→ `start.bat`（起動。足りないパッケージは自動で入れる）
- Node.js は Volta で `web/package.json` の版（22）を使う
- パッケージを追加したときは、`start.bat` で再起動すれば入る

### Mac で使うとき

- `setup.command`（最初の 1 回）→ `start.command`（起動）。中身は `setup.bat` / `start.bat` と同じ流れ
- Mac 標準の `python3` は 3.9 のことが多いので、`setup.command` は `python3.14`〜`python3.10` を探し、なければ Homebrew で `python@3.12` を入れる。Node.js も 22 未満なら Homebrew で入れる
- `.bat` を直したときは `.command` も合わせて直す

### 作業環境の制限（Claude のクラウド環境で作業するとき）

- `ui.shadcn.com` に接続できないことがある。そのときは GitHub の `shadcn-ui/ui` の `apps/v4/registry/new-york-v4/ui/` から部品を取り、`@/registry/new-york-v4/ui/` → `@/components/ui/`、`cn` の import を `@/lib/utils` に置き換える（CLI と同じ結果になる）
- リポジトリの設定（説明文・トピック）は API から変えられない。持ち主に GitHub の画面で変えてもらう
- コミットのメールアドレスは `shinnosukeogino@users.noreply.github.com` にする（公開リポジトリのため）
