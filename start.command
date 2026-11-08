#!/bin/bash
# kumishift の起動（Mac 用）。Finder でダブルクリックして使う
cd "$(dirname "$0")" || exit 1

[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
[ -d "$HOME/.volta/bin" ] && export PATH="$HOME/.volta/bin:$PATH"

if [ ! -x .venv/bin/python ] || [ ! -d web/node_modules ]; then
  echo "先に setup.command をダブルクリックして準備してください。"
  read -n1 -r -p "何かキーを押すと閉じます"
  exit 1
fi

echo "必要なものを確認しています（足りなければ自動で入れます）..."
.venv/bin/python -m pip install -q -e ".[api]"
if ! (cd web && npm install --no-audit --no-fund); then
  echo "[エラー] 画面のパッケージを入れられませんでした。上のメッセージを Claude に送ってください。"
  read -n1 -r -p "何かキーを押すと閉じます"
  exit 1
fi

echo
echo "kumishift を起動しています..."
echo " - API:  http://127.0.0.1:8000"
echo " - 画面: http://localhost:3000"
echo "終了するときは、このウィンドウで Control + C を押すか、ウィンドウを閉じてください。"
echo

# このウィンドウを閉じたら API と画面も止める
trap 'kill 0' EXIT INT TERM
.venv/bin/python -m kumishift serve &
(cd web && npm run dev) &

# 画面の起動を待ってからブラウザを開く
for _ in $(seq 1 60); do
  curl -s -o /dev/null http://localhost:3000 && break
  sleep 1
done
open http://localhost:3000
wait
