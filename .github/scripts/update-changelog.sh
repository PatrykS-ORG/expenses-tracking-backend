#!/usr/bin/env bash
# Prepend a Keep a Changelog section for NEW_TAG based on commits since OLD_TAG.
# Also writes RELEASE_NOTES.md for the GitHub Release body.
set -euo pipefail

NEW_TAG="${1:?Usage: update-changelog.sh <new_tag> [old_tag]}"
OLD_TAG="${2:-}"
CHANGELOG_FILE="${3:-CHANGELOG.md}"
NOTES_FILE="${4:-RELEASE_NOTES.md}"
DATE="$(date -u +%Y-%m-%d)"
VERSION="${NEW_TAG#v}"

LOG_ARGS=("--pretty=format:%s" "--no-merges")
if [[ -n "$OLD_TAG" ]] && git rev-parse --verify "$OLD_TAG" >/dev/null 2>&1; then
  LOG_ARGS+=("${OLD_TAG}..HEAD")
elif [[ -n "$OLD_TAG" ]]; then
  echo "Warning: old tag ${OLD_TAG} not found locally; using last 50 commits" >&2
  LOG_ARGS+=("-n" "50" "HEAD")
else
  LOG_ARGS+=("-n" "50" "HEAD")
fi

mapfile -t COMMITS < <(git log "${LOG_ARGS[@]}" 2>/dev/null || true)

FEATURES=()
FIXES=()
OTHER=()

strip_conventional_prefix() {
  local msg="$1"
  if [[ "$msg" == *': '* ]]; then
    printf '%s' "${msg#*: }"
  else
    printf '%s' "$msg"
  fi
}

conventional_type() {
  # "feat(scope)!: message" → "feat"
  local lower="$1"
  local prefix="${lower%%:*}"
  prefix="${prefix%%(*}"
  prefix="${prefix%%!*}"
  printf '%s' "$prefix"
}

for msg in "${COMMITS[@]:-}"; do
  [[ -z "$msg" ]] && continue
  lower="$(printf '%s' "$msg" | tr '[:upper:]' '[:lower:]')"
  ctype="$(conventional_type "$lower")"

  case "$ctype" in
    chore)
      if [[ "$lower" == chore\(release\):* ]]; then
        continue
      fi
      OTHER+=("- $msg")
      ;;
    feat)
      FEATURES+=("- $(strip_conventional_prefix "$msg")")
      ;;
    fix)
      FIXES+=("- $(strip_conventional_prefix "$msg")")
      ;;
    *)
      OTHER+=("- $msg")
      ;;
  esac
done

{
  echo "## [${VERSION}] - ${DATE}"
  if ((${#FEATURES[@]})); then
    echo
    echo "### Features"
    printf '%s\n' "${FEATURES[@]}"
  fi
  if ((${#FIXES[@]})); then
    echo
    echo "### Bug Fixes"
    printf '%s\n' "${FIXES[@]}"
  fi
  if ((${#OTHER[@]})); then
    echo
    echo "### Other"
    printf '%s\n' "${OTHER[@]}"
  fi
  if ((${#FEATURES[@]} + ${#FIXES[@]} + ${#OTHER[@]} == 0)); then
    echo
    echo "- No user-facing changes recorded in commit messages."
  fi
  echo
} >"$NOTES_FILE"

HEADER='# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Sections are generated automatically by `.github/workflows/release.yml` on each push to `production`.
'

BODY=""
if [[ -f "$CHANGELOG_FILE" ]]; then
  BODY="$(awk '/^## / { found=1 } found { print }' "$CHANGELOG_FILE")"
fi

{
  printf '%s\n' "$HEADER"
  cat "$NOTES_FILE"
  if [[ -n "$BODY" ]]; then
    printf '%s\n' "$BODY"
  fi
} >"${CHANGELOG_FILE}.tmp"
mv "${CHANGELOG_FILE}.tmp" "$CHANGELOG_FILE"

echo "Updated ${CHANGELOG_FILE} for ${NEW_TAG}"
