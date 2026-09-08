# Workspace Manager for Visual Studio Code

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/charles-rajendran.workspace-manager?label=Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=charles-rajendran.workspace-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="Workspace Manager Logo" />
</p>

<p align="center">
  <b>Orchestrate, configure, and execute shell commands across multi-repository workspaces with dynamic prompts, per-project overrides, and dedicated terminal management.</b>
</p>

---

## Why Workspace Manager?

Managing multi-root workspaces or monorepos with dozens of microservices often means juggling multiple terminals, repeatedly typing git commands, and manually running build or dev scripts across each project folder.

**Workspace Manager** provides a central mission-control dashboard inside VS Code to:
* Run commands simultaneously (or sequentially) across all or selected workspace projects.
* Fill in dynamic flags (like `-m "feat: my commit"`) with customized user prompts.
* Apply per-repository command overrides (e.g. running `ng serve` for frontend while other services run `npm start`).
* Automatically organize outputs into clean, dedicated project terminals (`[WM] <project-name>`).

---

## Quick Usage

Let's see **Workspace Manager** in action:

1. **Open your Workspace**: Open any multi-root workspace in VS Code (**File > Open Workspace from File...** or open a multi-folder workspace).
2. **Open the Dashboard**:
   - Click the **Workspace Manager** icon in the **Activity Bar** (left sidebar), OR
   - Click **`$(folder-library) Workspace Manager`** in the **Status Bar** (bottom-left), OR
   - Press `F1` (or `Cmd+Shift+P` / `Ctrl+Shift+P`), type `Workspace Manager: Open Dashboard`, and press `Enter`.
3. **Choose a Command**: Use the searchable combobox to select a preset (e.g. `Dev: Start All Services`, `Git: Bulk Commit & Push`, `Build: Build All Projects`).
4. **Enter Parameters & Select Projects**: If the command has dynamic options (such as `-m`), enter your parameter value and select which repositories should receive the command.
5. **Run**: Click **Run Across Repositories**! Watch as dedicated terminals launch and execute your command cleanly in parallel.

---

## Key Features

### ⚡ Run Saved Command (Preset Runner)
- **Searchable Combobox**: Live fuzzy typeahead filter over your saved command names and descriptions with full keyboard navigation (`↑`, `↓`, `Enter`, `Esc`).
- **Dynamic User Prompts**: Only displays input fields for flags that need values (e.g. `Enter commit message...` for `-m`).
- **Target Repositories Checklist**: Multi-select project toggles with "Select All" and "Deselect All" quick buttons.
- **Git Branch & Script Badges**: Automatically detects and displays the active Git branch (`main`, `develop`) and scripts detected from `package.json` for each project.
- **Live Execution Preview**: macOS-style terminal preview showing the exact assembled command for every repository before dispatching.

### ➕ Create New Command (Command Builder)
- **Custom Workflow Definition**: Build reusable commands with user-friendly names, descriptions, and base shell commands.
- **Dynamic Flags & Options**: Add customizable flags (e.g., `-m`, `--env`, `-b`) with custom placeholders, default values, and required validation.
- **Per-Repository Overrides**: Easily configure overrides for projects with unique requirements (e.g., run `pnpm dev` for one service and `cargo run` for another).
- **Flexible Persistence**: Save commands directly to `.vscode/workspace-commands.json` (persisted and shareable with team members via Git) or store them in private extension state.

### 🖥️ Intelligent Terminal Orchestration
- **Dedicated Project Terminals**: Creates clean terminals prefixed with `[WM] <repo-name>` with working directories (`cwd`) set directly to the repository's path.
- **Parallel or Sequential Modes**: Run commands across all repositories simultaneously, or stagger them sequentially for clean initialization.
- **1-Click Terminal Cleanup**: Dedicated "Close Managed Terminals" action closes all active `[WM]` terminals with a single click.

---

## Extension Commands

| Command | Command ID | Description |
| :--- | :--- | :--- |
| **Open Dashboard** | `workspaceManager.openDashboard` | Opens the full-screen interactive mission-control dashboard. |
| **Create New Command** | `workspaceManager.newCommand` | Opens the dashboard directly to the Command Builder tab. |
| **Run Preset** | `workspaceManager.runPreset` | Executes a saved preset directly from the Command Palette or Quick Presets sidebar. |
| **Refresh Projects** | `workspaceManager.refreshFolders` | Scans workspace folders, Git branches, and `package.json` scripts. |
| **Close All Terminals** | `workspaceManager.stopAllTerminals` | Closes all `[WM]` terminals managed by this extension. |

---

## Configuration & Settings

You can customize Workspace Manager through VS Code Settings (**Settings > Extensions > Workspace Manager**):

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `workspaceManager.reuseTerminals` | `boolean` | `true` | Reuse existing terminals for the same project instead of creating a new terminal every run. |
| `workspaceManager.terminalPrefix` | `string` | `"[WM]"` | Prefix used for managed terminal names (e.g. `[WM] web-frontend`). |
| `workspaceManager.saveFileLocation` | `string` | `"workspaceFile"` | Where to persist command presets: `"workspaceFile"` (`.vscode/workspace-commands.json`) or `"globalState"` (VS Code internal storage). |

---

## Contributing

Contributions are warmly welcome! Whether reporting an issue, proposing a feature, or submitting a pull request:

- Please read our [Contributing Guide](CONTRIBUTING.md) for full development setup, coding standards, and testing instructions.
- All participants are expected to adhere to our [Code of Conduct](.github/CODE_OF_CONDUCT.md).

---

## License

This project is open source and available under the [MIT License](LICENSE).
