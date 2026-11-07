@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ============================================
echo  kumishift の準備（最初の1回だけ）
echo ============================================
echo.

set PY=
where py > nul 2>&1 && set PY=py -3
if not defined PY (where python > nul 2>&1 && set PY=python)
if not defined PY (
  echo [エラー] Python が見つかりません。
  echo   https://www.python.org/downloads/ から Python 3.10 以上を入れてください。
  echo   インストール時に「Add python.exe to PATH」にチェックを入れてください。
  pause
  exit /b 1
)
where npm > nul 2>&1
if errorlevel 1 (
  echo [エラー] Node.js が見つかりません。
  echo   https://nodejs.org/ から Node.js 22 以上（LTS）を入れてください。
  pause
  exit /b 1
)

echo [1/3] Python の仮想環境を作っています...
if not exist ".venv" %PY% -m venv .venv
if errorlevel 1 goto fail

echo [2/3] エンジンと API を入れています...
call ".venv\Scripts\python.exe" -m pip install --upgrade pip > nul
call ".venv\Scripts\python.exe" -m pip install -e ".[api]"
if errorlevel 1 goto fail

echo [3/3] 画面（web）のパッケージを入れています...
cd web
call npm install
if errorlevel 1 goto fail
cd ..

echo.
echo 準備ができました。start.bat をダブルクリックすると起動します。
pause
exit /b 0

:fail
echo.
echo [エラー] 途中で失敗しました。上のメッセージを Claude に送ってください。
pause
exit /b 1
