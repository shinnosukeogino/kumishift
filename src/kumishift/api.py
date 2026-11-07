"""画面（web/）から呼ぶ API。

起動: kumishift serve  （または uvicorn kumishift.api:app --reload）

POST /api/solve
  リクエスト: 設定ファイル（YAML）と同じ内容の JSON
  レスポンス: シフト表のデータ（画面表示用）
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .html import to_view_data
from .model import ConfigError, parse_problem
from .solver import solve

app = FastAPI(title="kumishift API", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("KUMISHIFT_CORS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1回の計算にかけてよい最大秒数（公開サーバーで重い計算を防ぐ）
MAX_TIME_LIMIT = float(os.environ.get("KUMISHIFT_MAX_TIME_LIMIT", "30"))


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.post("/api/solve")
def solve_endpoint(config: dict[str, Any]) -> dict[str, Any]:
    try:
        problem = parse_problem(config)
    except ConfigError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    problem.rules.time_limit_seconds = min(problem.rules.time_limit_seconds, MAX_TIME_LIMIT)
    result = solve(problem)
    if not result.ok:
        if result.status == "解なし" and result.has_fixed:
            detail = (
                "手で直した勤務が、連勤・週の上限・月の最大出勤日数などのルールと合わないため、シフトを作れませんでした。"
                "手で直した勤務を見直すか、ルールをゆるめてください。"
            )
        else:
            detail = f"シフトを作れませんでした（{result.status}）。条件をゆるめるか、制限時間を延ばしてください。"
        raise HTTPException(status_code=422, detail=detail)
    return to_view_data(problem, result)
