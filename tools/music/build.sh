#!/bin/bash
# Rebuild public/js/music_ct.js from the MIDIs in tools/music/midi/ and re-derive the mix.
#   tools/music/build.sh            convert with the current tools/music/mix.json
#   tools/music/build.sh mix        also re-run the measured mix: per-voice balance, then track loudness
#   tools/music/build.sh fresh      same, starting from the levels in the MIDIs (deletes mix.json first)
# Needs Playwright for the measured steps:  export PW=/opt/node22/lib/node_modules/playwright
set -e
cd "$(dirname "$0")/../.."
OUT=public/js/music_ct.js
TMP=${TMPDIR:-/tmp}/ct_music_build
mkdir -p "$TMP"
conv() { python3 -I -B tools/music/midi2ct.py --quiet --out $OUT --report "$TMP/report.json" | tail -1; }
if [ "$1" = "fresh" ]; then rm -f tools/music/mix.json; fi
conv
if [ "$1" = "mix" ] || [ "$1" = "fresh" ]; then
  node tools/music/measure.cjs --report "$TMP/report.json" --voices --out "$TMP/a.json" > "$TMP/a.txt" 2>/dev/null
  node tools/music/automix.cjs --measure "$TMP/a.json" --report "$TMP/report.json"
  conv
  for pass in 1 2; do
    node tools/music/measure.cjs --out "$TMP/b.json" > "$TMP/b.txt" 2>/dev/null
    node tools/music/automix.cjs --measure "$TMP/b.json" --report "$TMP/report.json" --gainonly
    conv
  done
fi
echo "report: $TMP/report.json   check with: node tools/music/measure.cjs --report $TMP/report.json --voices"
