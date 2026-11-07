@echo off
chcp 65001 > nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo 先に setup.bat をダブルクリックして準備してください。
  pause
  exit /b 1
)
if not exist "web\node_modules" (
  echo 先に setup.bat をダブルクリックして準備してください。
  pause
  exit /b 1
)

echo 必要なものを確認しています（足りなければ自動で入れます）...
call ".venv\Scripts\python.exe" -m pip install -q -e ".[api]"
cd web
call npm install --no-audit --no-fund
if errorlevel 1 (
  cd ..
  echo [エラー] 画面のパッケージを入れられませんでした。上のメッセージを Claude に送ってください。
  pause
  exit /b 1
)
cd ..

echo kumishift を起動しています...
echo  - API:  http://127.0.0.1:8000
echo  - 画面: http://localhost:3000
echo 終了するときは、開いた2つの黒い画面を閉じてください。

start "kumishift API" cmd /k ".venv\Scripts\python.exe -m kumishift serve"
start "kumishift 画面" cmd /k "cd web && npm run dev"

rem 画面の起動を少し待ってからブラウザを開く
timeout /t 8 /nobreak > nul
start "" http://localhost:3000
