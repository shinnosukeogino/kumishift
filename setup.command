#!/bin/bash
# kumishift の準備（Mac 用・最初の 1 回だけ）。Finder でダブルクリックして使う
cd "$(dirname "$0")" || exit 1

fail() {
  echo
  echo "[エラー] $1"
  echo "  上のメッセージを Claude に送ってください。"
  read -n1 -r -p "何かキーを押すと閉じます"
  exit 1
}

echo "============================================"
echo " kumishift の準備（最初の1回だけ）"
echo "============================================"
echo

# Homebrew / Volta を使っていれば PATH に入れる
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
[ -d "$HOME/.volta/bin" ] && export PATH="$HOME/.volta/bin:$PATH"

# Python 3.10 以上を探す（Mac 標準の python3 は 3.9 のことが多い）
PY=""
for c in python3.14 python3.13 python3.12 python3.11 python3.10 python3; do
  p="$(command -v "$c" 2>/dev/null)" || continue
  if "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    PY="$p"; break
  fi
done
if [ -z "$PY" ]; then
  if command -v brew > /dev/null; then
    echo "Python 3.10 以上がないので Homebrew で入れます..."
    brew install python@3.12 || fail "Python を入れられませんでした。"
    PY="$(brew --prefix)/bin/python3.12"
  else
    open https://www.python.org/downloads/macos/
    fail "Python 3.10 以上が見つかりません。開いたページから入れて、もう一度 setup.command をダブルクリックしてください。"
  fi
fi

# Node.js 22 以上
if ! command -v npm > /dev/null || ! node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)'; then
  if command -v brew > /dev/null; then
    echo "Node.js 22 以上がないので Homebrew で入れます..."
    brew install node || fail "Node.js を入れられませんでした。"
  else
    open https://nodejs.org/
    fail "Node.js 22 以上が見つかりません。開いたページから LTS を入れて、もう一度 setup.command をダブルクリックしてください。"
  fi
fi
echo "Python: $("$PY" --version)  /  Node.js: $(node -v)"
echo

echo "[1/3] Python の仮想環境を作っています..."
[ -d .venv ] || "$PY" -m venv .venv || fail "仮想環境を作れませんでした。"

echo "[2/3] エンジンと API を入れています..."
.venv/bin/python -m pip install -q --upgrade pip
.venv/bin/python -m pip install -e ".[api]" || fail "エンジンと API を入れられませんでした。"

echo "[3/3] 画面（web）のパッケージを入れています..."
(cd web && npm install) || fail "画面のパッケージを入れられませんでした。"

echo
echo "準備ができました。start.command をダブルクリックすると起動します。"
read -n1 -r -p "何かキーを押すと閉じます"
