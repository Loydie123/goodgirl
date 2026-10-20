# Contributing to GoodGirl CLI

Thank you for contributing to GoodGirl CLI. This guide provides standards and commands for local development across macOS, Linux, and Windows.

---

## Prerequisites

- **Node.js**: `v22.0.0` or higher
- **pnpm**: `v10.0.0` or higher (recommended: `11.9.0`)

---

## Local Setup

1. **Install dependencies:**
   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Build workspace packages:**
   ```bash
   pnpm build
   ```

3. **Install Playwright browsers:**
   ```bash
   pnpm exec playwright install chromium
   ```

---

## Development Workflow

### Quality Verification Checklist

Before committing changes or opening a pull request, run all verification tasks:

```bash
pnpm lint          # Run ESLint across the repository
pnpm typecheck     # Verify strict TypeScript across all workspaces
pnpm test          # Run Vitest unit tests
pnpm qa doctor     # Verify environment diagnostics
pnpm qa test all   # Run Playwright E2E and API smoke tests
```

### Cross-Platform Development Rules

- **Path Resolution**: Never hardcode Unix `/` or Windows `\` path separators. Always use Node's `node:path` utilities (`join`, `resolve`, `normalize`).
- **Subprocesses**: Use `cross-spawn` with `process.execPath` to ensure reliable execution across PowerShell and POSIX shells.
- **Process Exit Codes**: Always capture and forward child process exit codes.
- **No Committed Artifacts**: Never commit `dist/`, `goodgirl-results/`, `test-results/`, or `.env` files.

---

## Commit Message Convention

GoodGirl follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat(cli)`: A new feature in the CLI application
- `feat(core)`: A new feature or capability in the core package
- `feat(playwright)`: Additions or changes to Playwright integration
- `feat(reporter)`: Changes to report formatting and result normalization
- `fix(core)`: Bug fixes
- `docs`: Documentation updates
- `test`: Adding or modifying unit or smoke tests
- `ci`: Changes to GitHub Actions workflows
- `chore`: Tooling, configuration, or dependency updates

---

## License Notice

License decision is currently pending.
