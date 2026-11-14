#!/usr/bin/env bash
# Makes a clean public copy of this project: the files of the current commit and nothing of its history.
#
# Why: the history of a private working repository holds things a public one must not (old addresses, personal
# e-mail addresses in commits, working notes). Rewriting such a history in place leaves the old commits
# reachable, so the public repository starts from one new commit instead.
#
# Usage:
#   scripts/make-public-snapshot.sh TARGET "Your Name" 12345+login@users.noreply.github.com
#
#   TARGET   an empty or new folder (the first publication), or an existing clone of the public repository
#            (an update: its files are replaced by the current ones and one new commit is made).
#   name     the author name for the commit.
#   e-mail   the author e-mail. Only a GitHub "noreply" address is accepted, so that a personal address cannot
#            slip into the public history. GitHub shows yours in Settings > Emails.
#
#   PUBLIC_TREE_PRIVATE_VALUES=/path/to/list  a file with private words to look for (one per line): the host of
#            a private server, a name. Recommended. The file must live outside the repository.
#
# The script never pushes and never talks to GitHub: it prepares the folder and prints what to do next.
# Files marked `export-ignore` in .gitattributes stay out of the copy.
set -euo pipefail

say() { printf '%s\n' "$*"; }
fail() { printf 'Stopped: %s\n' "$*" >&2; exit 1; }

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ] || [ "$#" -lt 3 ]; then
  sed -n '2,/^set -euo/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//'
  [ "$#" -ge 3 ] || exit 2
  exit 0
fi

target="$1"
author_name="$2"
author_mail="$3"

case "$author_mail" in
  *@users.noreply.github.com) ;;
  *) fail "the e-mail must be a GitHub noreply address (…@users.noreply.github.com), so that no personal address becomes public." ;;
esac
[ -n "$author_name" ] || fail "the author name is empty."

root="$(git rev-parse --show-toplevel)"
cd "$root"

[ -z "$(git status --porcelain)" ] || fail "there are changes that are not committed. Commit or put them aside first: the copy is made from the last commit."

case "$(cd "$(dirname "$target")" 2>/dev/null && pwd)/$(basename "$target")/" in
  "$root"/*) fail "the target folder is inside this repository. Choose a folder outside it." ;;
esac

name="$(node -p "require('./package.json').productName || require('./package.json').name")"
version="$(node -p "require('./package.json').version")"

say "1/4 Looking through the files for private things…"
node scripts/public-tree-check.js || fail "the check found private things in the tracked files. Clean them and run again."

mode="first"
if [ -d "$target/.git" ]; then
  mode="update"
  [ -z "$(git -C "$target" status --porcelain)" ] || fail "the public clone at $target has changes that are not committed."
elif [ -e "$target" ] && [ -n "$(ls -A "$target" 2>/dev/null)" ]; then
  fail "$target exists, is not empty and is not a clone of the public repository."
fi

say "2/4 Copying the files of commit $(git rev-parse --short HEAD) to $target…"
mkdir -p "$target"
if [ "$mode" = "update" ]; then
  # Remove what the public copy tracks now, so that files deleted here disappear there too.
  git -C "$target" ls-files -z | (cd "$target" && xargs -0 -r rm -f --)
else
  git -C "$target" init -q -b main
fi
git archive --format=tar HEAD | tar -x -C "$target"

say "3/4 Checking the copy itself…"
git -C "$target" add -A
node scripts/public-tree-check.js --dir "$target" \
  || fail "the copy holds private things (see above). Nothing was committed in $target; 'git -C $target reset --hard' puts an existing clone back."

say "4/4 Making one commit…"
if git -C "$target" diff --cached --quiet; then
  say "Nothing changed since the last public commit. Nothing to do."
  exit 0
fi
if [ "$mode" = "update" ]; then
  message="$name $version"
  last="$(git -C "$target" log -1 --format=%s 2>/dev/null || true)"
  [ "$last" != "$message" ] || message="$name $version: update"
else
  message="$name $version"
fi
git -C "$target" -c user.name="$author_name" -c user.email="$author_mail" -c commit.gpgsign=false \
  commit -q -m "$message"
# Later commits made by hand in that folder keep the same public identity.
git -C "$target" config user.name "$author_name"
git -C "$target" config user.email "$author_mail"

say ""
say "Done: $target holds $(git -C "$target" ls-files | wc -l | tr -d ' ') files and the commit \"$message\"."
if [ "$mode" = "first" ]; then
  cat <<'NEXT'

What to do next (you do this yourself; the script never pushes):
  1. GitHub > Settings > Emails: turn on "Keep my email addresses private" and
     "Block command line pushes that expose my email".
  2. Create a NEW, EMPTY public repository (no README, no licence, no .gitignore).
  3. In the target folder:
       git remote add origin https://github.com/<you>/<name>.git
       git push -u origin main
  4. In the new repository: turn on secret scanning with push protection, Dependabot alerts, private
     vulnerability reporting; protect the branch main and the tags v*; turn on Discussions.
  5. Never push from the old private clone to the public repository: no `--mirror`, no `--all`, no `--tags`.
     The old repository stays private as an archive.
NEXT
else
  say "Look at it with 'git -C $target show --stat', then push: git -C $target push"
fi
