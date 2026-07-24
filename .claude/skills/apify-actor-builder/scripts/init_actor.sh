#!/usr/bin/env bash
# Scaffold a new Apify actor from the bundled templates.
#
# Usage:
#   init_actor.sh <target-dir> <actor-name> <actor-title> "<actor-description>"
#
# Example:
#   init_actor.sh ./my-actor linkedin-jobs-scraper "LinkedIn Jobs Scraper" "Scrape LinkedIn job posts with filters."
#
# Copies Dockerfile, package.json, .gitignore, .actor/, src/, and test/ into
# <target-dir>, substituting {{ACTOR_NAME}}, {{ACTOR_TITLE}}, {{ACTOR_DESCRIPTION}}.
# Does NOT overwrite files that already exist, so it's safe to re-run.
set -euo pipefail

TARGET_DIR="${1:?target dir required}"
ACTOR_NAME="${2:?actor name required}"
ACTOR_TITLE="${3:?actor title required}"
ACTOR_DESCRIPTION="${4:?actor description required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES="$SCRIPT_DIR/../assets/templates"

mkdir -p "$TARGET_DIR/.actor" "$TARGET_DIR/src" "$TARGET_DIR/test"

copy_tpl() {
    local rel="$1"
    local dest="$TARGET_DIR/$rel"
    if [ -e "$dest" ]; then
        echo "skip (exists): $rel"
        return
    fi
    sed -e "s|{{ACTOR_NAME}}|$ACTOR_NAME|g" \
        -e "s|{{ACTOR_TITLE}}|$ACTOR_TITLE|g" \
        -e "s|{{ACTOR_DESCRIPTION}}|$ACTOR_DESCRIPTION|g" \
        "$TEMPLATES/$rel" > "$dest"
    echo "created: $rel"
}

copy_tpl Dockerfile
copy_tpl package.json
copy_tpl .gitignore
copy_tpl .actor/actor.json
copy_tpl .actor/input_schema.json
copy_tpl src/main.js
copy_tpl src/filters.js
copy_tpl test/fixture-server.mjs
copy_tpl test/unit.mjs

echo ""
echo "Scaffold ready in $TARGET_DIR"
echo "Next: edit .actor/input_schema.json (filters from the interview) and implement src/main.js."
