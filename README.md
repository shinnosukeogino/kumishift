# kumishift（くみシフト）

日本の現場向けの、**シフト表を自動で作るオープンソースツール**です。
スタッフ・必要人数・希望休を設定ファイルに書くと、ルールを守ったシフト表を作り、Excel で開ける CSV や、ブラウザで見られる画面イメージ（HTML）に書き出します。

組み方は2通りあります。

- **勤務パターンモード**: 早番・遅番・夜勤など、決まった勤務に割り当てる（介護・クリニック・工場など）
- **時間帯モード**: 営業時間と「何時から何時まで何人必要か」を書くと、勤務の時間（例: 10-15、17-22）も自動で決める（飲食・小売・カフェなど）

計算には Google の最適化ライブラリ [OR-Tools](https://github.com/google/or-tools)（CP-SAT）を使っています。業種は問わず、早番・遅番・夜勤など勤務の種類は自由に決められます。

```
結果: 最適

    1/1(祝)   1/2(土)   1/3(日)   1/4(月)   1/5(火)   1/6(水)   1/7(木)
田中  -         早        早        -         早        -         -
佐藤  早        遅        -         中        -         遅        遅
鈴木  -         遅        中        早        中        中        -
...

✓ すべての枠が埋まり、希望もすべて守れました
```

## できること

**必ず守るルール**

- 1日に入る勤務は1人1つまで
- 入れる勤務・出勤できる曜日（例: 土日だけ、遅番だけ）
- 希望休・NG（この日のこの勤務は不可）
- 期間内の最大出勤日数、最大連勤日数、週の最大勤務時間
- 禁止する並び（例: 遅番の翌日に早番は入れない）

**できるだけ守るルール**（重みを変えて優先度を調整できます）

- 必要人数を満たす（足りない枠は結果に表示します。人数不足でも「解なし」にはなりません）
- 必要人数より多く入れない
- 最低出勤日数
- 希望の勤務に入れる
- 出勤日数・土日祝の出勤日数をスタッフ間で平等にする

**入出力**

- 入力: YAML または JSON
- 出力: CSV（BOM 付き UTF-8 なので Excel でそのまま開けます）、画面イメージ（HTML）、JSON（ほかのシステムとの連携用）

**画面イメージ（HTML）**

`--html shift.html` を付けると、ブラウザで開くだけで見られるシフト表を1ファイルで書き出します。印刷もできます。

- 月間: スタッフ × 日付の一覧（勤務の時間帯で色分け、土日祝・定休日を表示）
- 日別: 1日の勤務をバーで表示し、時間ごとの「人数/必要人数」と不足を表示
- スタッフ: 出勤日数・勤務時間・土日祝の出勤日数

## 画面で使う（Web アプリ）

ブラウザで、設定 → シフト入力 → シフト表 の順に使えます。データはブラウザに保存されます。

| 画面 | できること |
| --- | --- |
| **設定** | スタッフ（入れる曜日・時間帯・1日/週/月の上限・連勤・平等化の対象）、営業時間（曜日ごと・定休日・祝日）、時間ごとの必要人数（プレビュー付き）、祝日・臨時休業日、勤務のルール |
| **シフト入力** | 月ごとに、スタッフ×日付のマスで「休み希望・出勤希望・NG（終日）・時間NG」を入力。ドラッグでまとめて入力できます |
| **シフト表** | 「シフトを作成」で自動作成。月間の一覧、日別の時間帯バーと人数/必要人数、スタッフごとの集計。不足や守れなかった希望も表示。印刷もできます |

```bash
# 1. エンジンと API
pip install -e ".[api]"
kumishift serve            # http://127.0.0.1:8000

# 2. 画面（別のターミナルで）
cd web
npm install
npm run dev                # http://localhost:3000
```

画面は Next.js + TypeScript + [shadcn/ui](https://ui.shadcn.com)（Tailwind CSS + Radix UI）、入力フォームは React Hook Form + Zod で作っています。

## インストール

Python 3.10 以上が必要です。

```bash
git clone https://github.com/<your-account>/kumishift.git
cd kumishift
pip install -e .
```

## 使い方

```bash
# 勤務パターンモード
kumishift solve examples/basic.yaml -o shift.csv --html shift.html

# 時間帯モード（営業時間あり）
kumishift solve examples/hourly.yaml -o shift.csv --html shift.html --title "1月前半シフト"
```

| オプション | 内容 |
| --- | --- |
| `-o, --output` | CSV の出力先 |
| `--html` | 画面イメージ（HTML）の出力先 |
| `--title` | 画面イメージのタイトル |
| `--json` | JSON の出力先 |
| `--time-limit` | 計算の制限時間（秒） |
| `-q, --quiet` | 画面にシフト表を表示しない |

制限時間内に一番良い案が見つかった時点で結果を返します。人数や期間が大きいときは `--time-limit 30` のように延ばしてください。

## 設定ファイルの書き方

[examples/basic.yaml](examples/basic.yaml) にコメント付きのサンプルがあります。最小構成はこれだけです。

```yaml
period:
  start: 2027-01-01
  end: 2027-01-31

shifts:
  - { code: 早, name: 早番, start: "09:00", end: "15:00" }
  - { code: 遅, name: 遅番, start: "16:00", end: "22:00" }

staff:
  - { name: 田中 }
  - { name: 佐藤, weekdays: [土, 日] }
  - { name: 鈴木, shifts: [遅], max_days: 12 }

demand:
  default: { 早: 1, 遅: 1 }
  weekdays:
    土: { 早: 2, 遅: 2 }

requests:
  - { name: 田中, date: 2027-01-08, type: 休み }
```

### 項目一覧

| 項目 | 内容 |
| --- | --- |
| `period.start` / `period.end` | シフトを作る期間 |
| `holidays` | 祝日の日付リスト。必要人数の `祝` と、土日祝の平等化に使います |
| `shifts` | 勤務の種類。`code`（表に出る記号）、`name`、`start`、`end`。終了が開始より早ければ日またぎ（夜勤）として計算します |
| `staff` | スタッフ。下の表を参照 |
| `demand` | 必要人数。`default` → `weekdays`（月〜日・祝）→ `dates`（日付指定）の順に上書き |
| `requests` | 希望。`type` は `休み` / `希望`（その日に出勤したい。`shift` を付けるとその勤務に入りたい）/ `NG`（`shift` を省略するとその日は丸ごと不可） |
| `rules.forbidden_sequences` | 禁止する並び。`[前日の勤務, 翌日の勤務]` |
| `rules.max_consecutive` | 全員共通の最大連勤日数（初期値 6） |
| `rules.hope_off_is_hard` | `true` なら希望休を必ず守る。`false` ならできるだけ守る |
| `rules.time_limit_seconds` | 計算の制限時間（初期値 10 秒） |
| `weights` | できるだけ守るルールの重み。数字が大きいほど優先 |

**staff の項目**

| 項目 | 内容 |
| --- | --- |
| `name` | 名前（必須・重複不可） |
| `shifts` | 入れる勤務の code のリスト（省略するとすべて） |
| `weekdays` | 出勤できる曜日（例: `[月, 水, 金]`。省略するとすべて） |
| `min_days` / `max_days` | 期間内の出勤日数の下限・上限 |
| `max_consecutive` | このスタッフの最大連勤日数 |
| `max_hours_per_week` | 週（月曜〜日曜）の勤務時間の上限 |
| `fair` | `false` にすると出勤日数の平等化の対象から外します（短時間パートなど） |

## 時間帯モード（営業時間から組む）

`shifts` の代わりに `hourly` を書きます。サンプルは [examples/hourly.yaml](examples/hourly.yaml) です。

```yaml
hourly:
  step_minutes: 60      # 時間の区切り（15 / 30 / 60 分）
  min_hours: 4          # 1回の勤務の最短時間
  max_hours: 8          # 1回の勤務の最長時間

  business_hours:       # 営業時間。default → 曜日 → 祝日 → 日付指定 の順に上書き
    default: { open: "10:00", close: "21:00" }
    weekdays:
      土: { open: "09:00", close: "22:00" }
      水: 定休日
    dates:
      2027-01-11: { open: "09:00", close: "20:00" }

  default_count: 1      # 下で指定しない時間の必要人数
  demand:               # 時間ごとの必要人数（from 〜 to の前まで）
    default:
      - { from: "11:00", to: "14:00", count: 3 }
      - { from: "17:00", to: "20:00", count: 2 }
    weekdays:
      土:
        - { from: "11:00", to: "15:00", count: 4 }
```

- 営業時間は `close` が `open` より早ければ日またぎ（例: 18:00〜02:00）として扱います。
- 勤務はすべて営業時間の中に収まるように組みます。

**スタッフに追加できる項目**

| 項目 | 内容 |
| --- | --- |
| `available_from` / `available_to` | 入れる時間帯（例: 学生は `available_from: "17:00"`） |
| `min_hours_per_day` / `max_hours_per_day` | 1日の勤務時間の下限・上限 |

**時間を指定した NG**

```yaml
requests:
  - { name: 佐藤, date: 2027-01-14, type: NG, from: "17:00", to: "21:00" }  # 夜だけ不可
```

`weights.hours_fairness` で、合計勤務時間の偏りをどれだけ嫌うかを調整できます。

## API

`kumishift serve` で起動します。`POST /api/solve` に設定ファイルと同じ内容の JSON を送ると、シフト表のデータが返ります。
条件に問題があるときは 422 と日本語のエラーメッセージを返します。

| 環境変数 | 内容 |
| --- | --- |
| `KUMISHIFT_CORS` | 画面の URL（カンマ区切り。初期値 `http://localhost:3000`） |
| `KUMISHIFT_MAX_TIME_LIMIT` | 1回の計算の最大秒数（初期値 30） |

## Python から使う

```python
from kumishift import parse_problem, solve
from kumishift.output import to_dict

problem = parse_problem({
    "period": {"start": "2027-01-01", "end": "2027-01-07"},
    "shifts": [{"code": "早", "start": "09:00", "end": "15:00"}],
    "staff": [{"name": "田中"}, {"name": "佐藤"}],
    "demand": {"default": {"早": 1}},
})
result = solve(problem)
print(to_dict(problem, result))
```

## 注意

- 週の勤務時間は、期間内の月曜〜日曜で区切って数えます。期間の前の月の勤務は含みません。
- 時間帯モードは組み合わせが多いので、スタッフや期間が大きいときは計算に時間がかかります。`--time-limit` を延ばすか、`step_minutes` を 60 にしてください。
- 労働基準法などの法令に適合することを保証するものではありません。作成したシフトは、必ず担当者が確認してから使ってください。

## 今後の予定

- Excel / CSV からの入力
- シフト表を画面上で手で直す（ドラッグで時間を変える）
- スタッフ本人がスマホから希望を出せる画面
- データをサーバーに保存（複数人・複数店舗）
- 休憩時間の自動計算
- 開店前の準備・閉店後の片付けの時間
- 業種別のテンプレート（飲食・介護・クリニック・小売など）

要望や不具合は Issue でお知らせください。プルリクエストも歓迎します。

## ライセンス

[MIT License](LICENSE) © Maestea LLC（マエスティ合同会社）

導入やカスタマイズのご相談は [maestea.co.jp](https://maestea.co.jp) まで。
