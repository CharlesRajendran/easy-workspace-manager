import * as vscode from 'vscode';
import { PresetService } from '../services/PresetService';
import { DashboardPanel } from './DashboardPanel';
import { PresetTreeItem } from './PresetTreeItem';

export { PresetTreeItem };

export class SidebarPresetsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private changeEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();

  readonly onDidChangeTreeData = this.changeEmitter.event;

  private presetService: PresetService;

  private extensionUri: vscode.Uri;

  constructor(presetService: PresetService, extensionUri: vscode.Uri) {
    this.presetService = presetService;
    this.extensionUri = extensionUri;

    DashboardPanel.onPresetsChanged(() => {
      this.refresh();
    });
  }

  public refresh(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }

    const presets = await this.presetService.getPresets();
    if (presets.length === 0) {
      const emptyItem = new vscode.TreeItem('No presets found');
      emptyItem.description = 'Click + to create one';
      emptyItem.iconPath = new vscode.ThemeIcon('info');
      emptyItem.command = {
        command: 'workspaceManager.newCommand',
        title: 'Create Command',
      };
      return [emptyItem];
    }

    return presets.map((p) => new PresetTreeItem(p));
  }
}
