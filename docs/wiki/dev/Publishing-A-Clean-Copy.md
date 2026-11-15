[Русский](Publishing-A-Clean-Copy.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Publishing a clean copy

Why the public repository can start from one commit, and the two scripts that make such a copy.

## Why one commit

The history of a private working repository holds things a public one must not: old addresses, personal e-mail
addresses in commits, working notes. Rewriting that history in place leaves the old commits reachable, so a clean
public copy starts from one new commit with the files of the current commit and nothing of the history.

## 1. Check the tree

```bash
node scripts/public-tree-check.js
```

It reads every tracked file and looks for what must not be public: a personal e-mail address, a link to a private
work session, a line that says who typed a commit, a path inside somebody's home folder, an address inside a private
network, a key, a file that should never be tracked. It changes nothing; it exits with 1 when something is found and
hides the middle of each find (`--show` prints it in full).

Private values the script cannot guess (the host of a private server, a name, the name of a private node pack) go
into a file outside the repository, one per line (`#` starts a comment):

```bash
node scripts/public-tree-check.js --values /home/you/private-values.txt
# or
PUBLIC_TREE_PRIVATE_VALUES=/home/you/private-values.txt node scripts/public-tree-check.js
```

`--dir FOLDER` checks another folder. `tests/unit/publicTreeCheck.test.ts` runs the check on every test run.

## 2. Make the copy

```bash
scripts/make-public-snapshot.sh TARGET "Your Name" 12345+login@users.noreply.github.com
```

- `TARGET` is an empty or new folder (the first publication) or an existing clone of the public repository (an
  update: its files are replaced by the current ones and one new commit is made).
- The author e-mail must be a GitHub "noreply" address, so no personal address enters the public history. GitHub
  shows yours in Settings ▸ Emails.
- Files marked `export-ignore` in `.gitattributes` stay out of the copy (the team's research notes, for example).
- It works only on a clean working tree (the copy is made from the last commit), checks the tree first and checks the
  copy again before its commit; `PUBLIC_TREE_PRIVATE_VALUES` is used both times.

**What it never does:** it never pushes and never talks to GitHub. It prepares the folder, makes one commit and prints
what to do next; you look and push yourself.

## See also

- [For developers](README.md)
- [Releasing](Releasing.md)
- [Security](../trust/Security.md)
