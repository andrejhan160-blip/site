#!/bin/sh
# Подставляет реальный домен вместо заглушки SITE_URL во всех файлах сайта.
# Запуск из папки с сайтом:  sh set-domain.sh sadullaev.marketing
set -e
[ -n "$1" ] || { echo "Использование: sh set-domain.sh example.com"; exit 1; }
DOMAIN=$(printf '%s' "$1" | sed -e 's#^https\{0,1\}://##' -e 's#/$##')
DIR=$(dirname "$0")
find "$DIR" -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' \) \
  -exec sed -i.bak "s#https://SITE_URL#https://$DOMAIN#g" {} +
find "$DIR" -name '*.bak' -delete
echo "Домен заменён на https://$DOMAIN"
