#!/bin/sh

APP_NAME=$1
INPUT_NAME=$(ls ./apps/${APP_NAME}/build/appconfig | bash ./scripts/listmenu.sh "config" 20 60 13)

if [ -n "$INPUT_NAME" ]; then
    echo "[app_config_choice] Cleaning app build artifacts..." >&2
    rm -rf ./output/*/.objs/static/apps/${APP_NAME}/ 2>/dev/null
    rm -f ./libs/lib${APP_NAME}.a ./libs/lib${APP_NAME}.a.stripped 2>/dev/null
    echo "[app_config_choice] Done." >&2
fi

echo $INPUT_NAME
