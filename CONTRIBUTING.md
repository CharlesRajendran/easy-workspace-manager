# Contributing to Workspace Manager

First off, thank you for considering contributing to **Workspace Manager**! 🎉

This document provides guidelines and instructions for contributing to this open source project.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to the project maintainer.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20 recommended)
- [npm](https://www.npmjs.com/) (v9 or later)
- [Visual Studio Code](https://code.visualstudio.com/) (v1.85.0 or later)
- [Git](https://git-scm.com/)

### Setting Up the Local Repository

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/vsc-workspace-manager.git
   cd vsc-workspace-manager
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Compile the extension**:
   ```bash
   npm run compile
   ```

---

## Development Workflow

### Running & Debugging the Extension

1. Open this repository in VS Code:
   ```bash
   code .
   ```
2. Press **`F5`** (or select **Run > Start Debugging**) to launch an **Extension Development Host** window.
3. In the new window, open the sample multi-root workspace:
   **File > Open Workspace from File...** > select `test/fixtures/example-workspace/demo.code-workspace`.
4. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type:
   `Workspace Manager: Open Workspace Manager Dashboard`
5. Alternatively, click the **Workspace Manager** icon in the Activity Bar or status bar.

### Watching for Changes

During development, start the build watcher:
```bash
npm run watch
```
Any changes to TypeScript files in `src/` will be re-bundled automatically. In the Extension Development Host window, press `Cmd+R` / `Ctrl+R` to reload and see your changes.

---

## Code Style & Standards

We enforce the **Airbnb TypeScript Style Guide** across all TypeScript files.

- **Linting**:
  ```bash
  npm run lint
  ```
- **Auto-fixing lint issues**:
  ```bash
  npm run lint:fix
  ```

All contributions must pass `npm run lint` with **0 errors and 0 warnings**.

---

## Running Tests

We have automated unit tests covering command assembly, repository discovery, and terminal runner logic.

Run the test suite:
```bash
npm test
```

Please ensure that:
1. All existing tests pass.
2. Any new features or bug fixes include corresponding unit tests in `test/runner.test.ts`.

---

## Commit Message Conventions

This repository follows the [Conventional Commits](https://www.conventionalcommits.org/) specification. This format powers automated changelog generation and semantic versioning via `standard-version`.

Format: `<type>(<scope>): <short description>`

### Commit Types:
- `feat`: A new feature (triggers a `minor` version bump)
- `fix`: A bug fix (triggers a `patch` version bump)
- `perf`: A code change that improves performance
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `docs`: Documentation changes only
- `style`: Changes that do not affect the meaning of the code (formatting)
- `test`: Adding or correcting tests
- `chore`: Maintenance tasks, dependency updates, build tooling
- `BREAKING CHANGE:` In the commit footer to trigger a `major` bump

### Examples:
```
feat: add dark mode theme toggle to dashboard
fix: escape double quotes in custom flag values
docs: add troubleshooting section to README
```

---

## Submitting a Pull Request

1. Create a new topic branch from `master`:
   ```bash
   git checkout -b feature/my-cool-feature
   ```
2. Make your changes and write unit tests where appropriate.
3. Verify all checks pass locally:
   ```bash
   npm run lint
   npm test
   npm run compile
   ```
4. Commit your changes following the [Commit Message Conventions](#commit-message-conventions).
5. Push to your fork:
   ```bash
   git push origin feature/my-cool-feature
   ```
6. Open a **Pull Request** against the `master` branch.
7. Fill out the PR description explaining what your changes do and why.

---

## Maintainer Release Workflow

For project maintainers cutting releases:

```bash
# Preview the version bump & changelog updates
npm run release:dry-run

# Run automated release (bumps version, updates CHANGELOG.md, creates commit & tag)
npm run release

# Push release and tags to GitHub
git push --follow-tags origin master

# Publish to Visual Studio Marketplace directly via CLI:
npm run publish:vsce
```

---

Thank you for helping make **Workspace Manager** better for everyone!
