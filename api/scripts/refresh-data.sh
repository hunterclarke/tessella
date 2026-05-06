#!/usr/bin/env bash
set -uo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$DIR/priv/data"

fetch_file() {
  local group="$1"
  local format="$2"
  local extension="$3"
  local output="$DATA_DIR/${group}.${extension}"

  echo "Fetching ${group}.${extension}..."

  if curl \
    --fail \
    --location \
    --show-error \
    --get \
    --data-urlencode "GROUP=${group}" \
    --data-urlencode "FORMAT=${format}" \
    "https://celestrak.org/NORAD/elements/gp.php" \
    --output "$output"; then
    echo "Wrote ${output}"
  else
    echo "Failed to fetch ${group}.${extension}; leaving existing file unchanged" >&2
    return 1
  fi
}

mkdir -p "$DATA_DIR"

failed=0

for group in active stations starlink; do
  if ! fetch_file "$group" json json; then
    failed=1
  fi

  if ! fetch_file "$group" tle tle; then
    failed=1
  fi
done

exit "$failed"
