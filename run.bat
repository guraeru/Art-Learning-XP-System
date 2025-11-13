@echo off

:: conda環境をアクティブにする
call "%USERPROFILE%\anaconda3\condabin\conda.bat" activate base

:: スクリプトを実行
python app.py

pause