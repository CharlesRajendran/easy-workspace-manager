import * as vscode from 'vscode';
import { CommandOption, TargetExecution } from '../types';
import { CommandAssembler } from './CommandAssembler';

export class TerminalRunner {
  public static assembleCommand(
    baseCommand: string,
    options: CommandOption[],
    userValues: Record<string, string>,
  ): string {
    return CommandAssembler.assembleCommand(baseCommand, options, userValues);
  }

  public static async executeAcrossTargets(
    targets: TargetExecution[],
    mode: 'parallel' | 'sequential' = 'parallel',
  ): Promise<void> {
    if (!targets || targets.length === 0) {
      vscode.window.showWarningMessage('No repositories selected for execution.');
      return;
    }

    const config = vscode.workspace.getConfiguration('workspaceManager');
    const reuseTerminals = config.get<boolean>('reuseTerminals', true);
    const prefix = config.get<string>('terminalPrefix', '[WM]');

    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      const terminalName = `${prefix} ${target.repoName}`;

      let terminal: vscode.Terminal | undefined;

      if (reuseTerminals) {
        terminal = vscode.window.terminals.find((t) => t.name === terminalName);
      }

      if (!terminal) {
        terminal = vscode.window.createTerminal({
          name: terminalName,
          cwd: target.repoPath,
        });
      }

      // Show the terminal window without forcing focus away from webview
      terminal.show(true);

      // Send the command
      terminal.sendText(target.command, true);

      // In sequential mode, stagger slightly so terminals can initialize cleanly
      if (mode === 'sequential' && i < targets.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => { setTimeout(resolve, 600); });
      }
    }

    vscode.window.showInformationMessage(
      `Dispatched command to ${targets.length} terminal${targets.length === 1 ? '' : 's'}.`,
    );
  }

  public static openSingleTerminal(repoPath: string, repoName: string): void {
    const config = vscode.workspace.getConfiguration('workspaceManager');
    const prefix = config.get<string>('terminalPrefix', '[WM]');
    const terminalName = `${prefix} ${repoName}`;

    let terminal = vscode.window.terminals.find((t) => t.name === terminalName);
    if (!terminal) {
      terminal = vscode.window.createTerminal({
        name: terminalName,
        cwd: repoPath,
      });
    }
    terminal.show(false);
  }

  public static closeAllManagedTerminals(): void {
    const config = vscode.workspace.getConfiguration('workspaceManager');
    const prefix = config.get<string>('terminalPrefix', '[WM]');

    const managed = vscode.window.terminals.filter((t) => t.name.startsWith(prefix));
    managed.forEach((t) => t.dispose());

    vscode.window.showInformationMessage(`Closed ${managed.length} managed terminals.`);
  }
}
