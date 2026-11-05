#!/bin/sh
# webm recordings → mp4 the film can seek (short GOP), into assets/video
cd "$(dirname "$0")/.." || exit 1
for f in ../recordings-v2/*.webm; do
  n=$(basename "$f" .webm); case "$n" in page@*) continue;; esac
  [ "assets/video/$n.mp4" -nt "$f" ] && continue
  ffmpeg -hide_banner -loglevel error -y -i "$f" -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -r 30 -g 15 -an "assets/video/$n.mp4" && echo "converted $n"
done
