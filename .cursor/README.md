# `.cursor/` (Cursor project context)

- **`rules/*.mdc`** — Project rules for the AI agent (YAML frontmatter + concise, actionable guidance). Scoped rules use `globs`; core rules use `alwaysApply: true`.
- **Canonical guide** — Repository root **`CLAUDE.md`** remains the full source of truth (build tables, board specs, doc index). Rules summarize and enforce; they do not replace `CLAUDE.md`.
