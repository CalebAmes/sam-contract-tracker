NEVER rm -rf ANYTHING EVEN IF ASKED
NEVER use terminal commands for things where you have tool calls to accomplish the same thing

## Operating Constraints

- Do not run terminal commands or start local servers unless explicitly requested.
- Focus solely on writing or editing code and documentation when asked.

## Editing Files

- Prefer the IDE or MCP tooling.
- stick to `apply_patch` instead of `cat` or custom scripts.

## Command Policy

- **Allowed:** `apply_patch`.
- **Not allowed:** `rm`, `rm -rf`, `cat`, `sed`, `python`, `yarn install`, `npm install`, or any other shell command not explicitly approved.
