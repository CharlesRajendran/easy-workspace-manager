import * as vscode from 'vscode';
import { CommandPreset } from '../types';

export class PresetTreeItem extends vscode.TreeItem {
  constructor(public readonly preset: CommandPreset) {
    super(preset.name, vscode.TreeItemCollapsibleState.None);

    this.tooltip = `${preset.name}\nCommand: ${preset.baseCommand}\nMode: ${preset.executionMode || 'parallel'}`;
    this.description = preset.baseCommand;
    this.iconPath = new vscode.ThemeIcon('terminal');
    this.contextValue = 'preset';

    // Clicking item opens the dashboard focused on this preset
    this.command = {
      command: 'workspaceManager.openDashboardWithPreset',
      title: 'Open in Dashboard',
      arguments: [preset.id],
    };
  }
}
