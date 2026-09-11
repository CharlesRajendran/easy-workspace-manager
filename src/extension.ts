import * as vscode from 'vscode';
import { PresetService } from './services/PresetService';
import { TerminalRunner } from './services/TerminalRunner';
import { CommandAssembler } from './services/CommandAssembler';
import { DashboardPanel } from './views/DashboardPanel';
import { SidebarPresetsProvider, PresetTreeItem } from './views/SidebarPresetsProvider';
import { WorkspaceService } from './services/WorkspaceService';

export function activate(context: vscode.ExtensionContext) {
  const presetService = new PresetService(context);

  // Register Sidebar TreeView
  const sidebarProvider = new SidebarPresetsProvider(presetService, context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('workspace-manager.sidebarPresets', sidebarProvider),
  );

  // Create Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'workspaceManager.openDashboard';
  statusBarItem.text = '$(folder-library) Workspace Terminal Manager';
  statusBarItem.tooltip = 'Open Workspace Terminal Manager Multi-Project Dashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('workspaceManager.openDashboard', () => {
      DashboardPanel.render(context.extensionUri, presetService, 'runner');
    }),

    vscode.commands.registerCommand(
      'workspaceManager.openDashboardWithPreset',
      (presetId: string) => {
        DashboardPanel.render(
          context.extensionUri,
          presetService,
          'runner',
          presetId,
        );
      },
    ),

    vscode.commands.registerCommand('workspaceManager.newCommand', () => {
      DashboardPanel.render(context.extensionUri, presetService, 'builder');
    }),

    vscode.commands.registerCommand('workspaceManager.refreshFolders', async () => {
      sidebarProvider.refresh();
      if (DashboardPanel.currentPanel) {
        await DashboardPanel.currentPanel.sendStateUpdate();
      }
      vscode.window.showInformationMessage('Workspace Terminal Manager: Refreshed projects.');
    }),

    vscode.commands.registerCommand('workspaceManager.stopAllTerminals', () => {
      TerminalRunner.closeAllManagedTerminals();
    }),

    vscode.commands.registerCommand('workspaceManager.runPreset', async (item?: PresetTreeItem) => {
      let preset = item?.preset;

      if (!preset) {
        const presets = await presetService.getPresets();
        if (presets.length === 0) {
          vscode.window.showInformationMessage('No presets configured. Create one first!');
          DashboardPanel.render(context.extensionUri, presetService, 'builder');
          return;
        }

        const picked = await vscode.window.showQuickPick(
          presets.map((p) => ({
            label: p.name,
            description: p.baseCommand,
            detail: p.description,
            preset: p,
          })),
          { placeHolder: 'Select a command preset to execute across projects' },
        );

        if (!picked) {
          return;
        }
        preset = picked.preset;
      }

      // If preset has options or embedded template placeholders requiring input, open the dashboard
      const hasPlaceholders = CommandAssembler.extractPlaceholders(preset.baseCommand).length > 0
        || Object.values(preset.repoOverrides || {}).some(
          (cmd) => CommandAssembler.extractPlaceholders(cmd).length > 0,
        );

      if ((preset.options && preset.options.length > 0) || hasPlaceholders) {
        DashboardPanel.render(context.extensionUri, presetService, 'runner', preset.id);
        return;
      }

      // If no options, we can run directly across all workspace repos!
      const repos = await WorkspaceService.getWorkspaceRepos();
      if (repos.length === 0) {
        vscode.window.showWarningMessage('No workspace folders found.');
        return;
      }

      const targetRepos = preset.targetRepoIds && preset.targetRepoIds.length > 0
        ? repos.filter((r) => preset.targetRepoIds?.includes(r.id))
        : repos;

      const targets = targetRepos.map((r) => {
        const override = preset.repoOverrides?.[r.id];
        return {
          repoId: r.id,
          repoPath: r.path,
          repoName: r.name,
          command: override || preset.baseCommand,
        };
      });

      await TerminalRunner.executeAcrossTargets(targets, preset.executionMode || 'parallel');
    }),
  );
}

export function deactivate() {
  // Clean up if needed
}
