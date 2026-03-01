Review all staged and unstaged changes by running `git diff HEAD`.

If there are no changes, check for untracked files with `git status`.

Analyze the diff for:

**Critical** — must fix before committing:
- Security issues (exposed tokens, secrets, unvalidated URL params, XSS vectors)
- Logic bugs, off-by-one errors, null/undefined access
- Firebase or Azure Blob calls missing error handling
- Direct Redux state mutation

**Warning** — should fix:
- React anti-patterns (missing useEffect deps, inline object/array creation causing re-renders)
- Broken or incomplete functionality
- Inconsistency with existing code patterns

**Suggestion** — nice to have:
- Performance improvements
- Code clarity

Output findings as a numbered list grouped by severity. If no issues found, say so.
