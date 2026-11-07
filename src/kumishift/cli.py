"""コマンドライン: kumishift solve 設定ファイル.yaml -o shift.csv"""

from __future__ import annotations

import argparse
import sys

from . import __version__
from .model import ConfigError, load_problem
from .html import write_html
from .output import format_text, write_csv, write_json
from .solver import solve


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="kumishift", description="シフト表を自動で作ります。")
    parser.add_argument("--version", action="version", version=f"kumishift {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    sp = sub.add_parser("solve", help="設定ファイルからシフトを作る")
    sp.add_argument("config", help="設定ファイル（.yaml / .yml / .json）")
    sp.add_argument("-o", "--output", help="CSV の出力先（Excel で開けます）")
    sp.add_argument("--json", help="JSON の出力先（ほかのシステムと連携するとき）")
    sp.add_argument("--html", help="画面イメージ（HTML）の出力先。ブラウザで開けます")
    sp.add_argument("--title", default="シフト表", help="HTML のタイトル")
    sp.add_argument("--time-limit", type=float, help="計算の制限時間（秒）。設定ファイルより優先")
    sp.add_argument("-q", "--quiet", action="store_true", help="画面にシフト表を表示しない")

    args = parser.parse_args(argv)

    try:
        problem = load_problem(args.config)
    except FileNotFoundError:
        print(f"エラー: ファイルが見つかりません: {args.config}", file=sys.stderr)
        return 2
    except ConfigError as e:
        print(f"設定ファイルのエラー: {e}", file=sys.stderr)
        return 2

    if args.time_limit:
        problem.rules.time_limit_seconds = args.time_limit

    result = solve(problem)
    if not args.quiet:
        print(format_text(problem, result))
    if not result.ok:
        return 1
    if args.output:
        write_csv(problem, result, args.output)
        print(f"CSV を書き出しました: {args.output}")
    if args.html:
        write_html(problem, result, args.html, title=args.title)
        print(f"画面イメージ（HTML）を書き出しました: {args.html}")
    if args.json:
        write_json(problem, result, args.json)
        print(f"JSON を書き出しました: {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
