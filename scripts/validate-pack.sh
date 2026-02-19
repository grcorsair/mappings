#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/validate-pack.sh <pack.json>" >&2
  exit 2
fi

corsair mappings validate --file "$1"
