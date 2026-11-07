"""kumishift: 日本の現場向けシフト自動作成ツール"""

__version__ = "0.1.0"

from .model import ConfigError, Problem, load_problem, parse_problem  # noqa: E402
from .solver import Result, solve  # noqa: E402

__all__ = ["ConfigError", "Problem", "Result", "load_problem", "parse_problem", "solve"]
