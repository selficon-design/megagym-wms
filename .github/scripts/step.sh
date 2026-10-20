#!/usr/bin/env bash
# Τρέχει μια εντολή· αν αποτύχει, γράφει τις τελευταίες γραμμές ως σημείωση σφάλματος (annotation),
# ώστε το σφάλμα να φαίνεται και χωρίς να ανοίξει κανείς ολόκληρο το log. Τα secrets κρύβονται αυτόματα.
set -o pipefail
out=$(mktemp)
"$@" 2>&1 | tee "$out"; code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  msg=$(tail -n 15 "$out" | sed 's/\x1b\[[0-9;]*m//g' | tr '\n' ' ' | cut -c1-900)
  echo "::error title=$1 $2::$msg"
fi
exit "$code"
