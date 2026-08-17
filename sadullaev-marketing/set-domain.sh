#!/bin/sh
# Меняет домен сайта во всех файлах: canonical, og:url, og:image, JSON-LD,
# sitemap.xml, robots.txt. Текущий домен — sadullaev.pro.
# Запуск из папки с сайтом:  sh set-domain.sh new-domain.com
set -e
[ -n "$1" ] || { echo "Использование: sh set-domain.sh new-domain.com"; exit 1; }
OLD="sadullaev.pro"
NEW=$(printf '%s' "$1" | sed -e 's#^https\{0,1\}://##' -e 's#/$##')
DIR=$(dirname "$0")
find "$DIR" -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' \) \
  -exec sed -i.bak "s#https://$OLD#https://$NEW#g" {} +
find "$DIR" -name '*.bak' -delete
sed -i.bak "s#^OLD=\"$OLD\"#OLD=\"$NEW\"#" "$0" && rm -f "$0.bak"
echo "Домен изменён: $OLD -> $NEW"
