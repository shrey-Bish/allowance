#!/bin/sh
# renders/allowance-v2.mp4 → renders/allowance-v2-final.mp4: two-pass loudness to -14 LUFS, limiter so the
# true peak stays under -2 dBTP after the AAC encode (SCRIPT.md section 3), video stream copied untouched.
cd "$(dirname "$0")/.." || exit 1
IN=renders/allowance-v2.mp4; OUT=renders/allowance-v2-final.mp4; TMP=renders/_tmp
mkdir -p "$TMP"
ffmpeg -hide_banner -y -i "$IN" -af "loudnorm=I=-14:TP=-3:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p' > "$TMP/ln.json"
F=$(python3 -c "
import json;d=json.load(open('$TMP/ln.json'))
print('loudnorm=I=-14:TP=-3:LRA=11:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:offset=%s:linear=true'%(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'],d['target_offset']))")
ffmpeg -hide_banner -loglevel error -y -i "$IN" -vn -af "$F,alimiter=limit=0.69:level=false:attack=5:release=50" -c:a pcm_s16le "$TMP/a.wav"
ffmpeg -hide_banner -loglevel error -y -i "$TMP/a.wav" -c:a aac -b:a 256k "$TMP/a.m4a"
ffmpeg -hide_banner -loglevel error -y -i "$IN" -i "$TMP/a.m4a" -map 0:v -map 1:a -c:v copy -c:a copy -movflags +faststart "$OUT"
ffmpeg -hide_banner -i "$OUT" -af "loudnorm=I=-14:TP=-2:LRA=11:print_format=json" -f null - 2>&1 | grep -E '"input_i"|"input_tp"'
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
