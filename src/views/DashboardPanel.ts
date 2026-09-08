import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  ExtensionMessage,
  WebviewMessage,
} from '../types';
import { WorkspaceService } from '../services/WorkspaceService';
import { PresetService } from '../services/PresetService';
import { TerminalRunner } from '../services/TerminalRunner';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;

  private static onPresetsChangedEmitter = new vscode.EventEmitter<void>();

  public static readonly onPresetsChanged = DashboardPanel.onPresetsChangedEmitter.event;

  private readonly panel: vscode.WebviewPanel;

  private readonly extensionUri: vscode.Uri;

  private readonly presetService: PresetService;

  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    presetService: PresetService,
    initialTab: 'runner' | 'builder' = 'runner',
    initialPresetId?: string,
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.presetService = presetService;

    this.panel.webview.html = this.getHtmlForWebview();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleWebviewMessage(message),
      null,
      this.disposables,
    );

    // If workspace folders change while open, send updated state
    vscode.workspace.onDidChangeWorkspaceFolders(
      () => this.sendStateUpdate(initialTab, initialPresetId),
      null,
      this.disposables,
    );
  }

  public static render(
    extensionUri: vscode.Uri,
    presetService: PresetService,
    tab: 'runner' | 'builder' = 'runner',
    presetId?: string,
  ): DashboardPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      DashboardPanel.currentPanel.sendStateUpdate(tab, presetId);
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'workspaceManagerDashboard',
      'Workspace Manager',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'resources'),
        ],
      },
    );

    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'resources', 'icon.png');

    DashboardPanel.currentPanel = new DashboardPanel(
      panel,
      extensionUri,
      presetService,
      tab,
      presetId,
    );
    return DashboardPanel.currentPanel;
  }

  private async handleWebviewMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
      case 'refresh': {
        await this.sendStateUpdate();
        break;
      }
      case 'runCommand': {
        const { payload } = message;
        try {
          await TerminalRunner.executeAcrossTargets(payload.targets, payload.mode);
          this.postMessage({
            type: 'executionSuccess',
            payload: { count: payload.targets.length, targets: payload.targets },
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to run command: ${errorMsg}`);
          this.postMessage({
            type: 'executionError',
            payload: { message: errorMsg || 'Execution failed' },
          });
        }
        break;
      }
      case 'savePreset': {
        const { payload } = message;
        await this.presetService.savePreset(payload);
        DashboardPanel.onPresetsChangedEmitter.fire();
        vscode.window.showInformationMessage(`Preset "${payload.name}" saved successfully!`);
        await this.sendStateUpdate('runner', payload.id);
        break;
      }
      case 'deletePreset': {
        const { payload } = message;
        await this.presetService.deletePreset(payload.id);
        DashboardPanel.onPresetsChangedEmitter.fire();
        vscode.window.showInformationMessage('Preset deleted.');
        await this.sendStateUpdate('runner');
        break;
      }
      case 'openTerminal': {
        TerminalRunner.openSingleTerminal(message.payload.repoPath, message.payload.repoName);
        break;
      }
      case 'showNotice': {
        const { payload } = message;
        if (payload.type === 'error') {
          vscode.window.showErrorMessage(payload.message);
        } else if (payload.type === 'warning') {
          vscode.window.showWarningMessage(payload.message);
        } else {
          vscode.window.showInformationMessage(payload.message);
        }
        break;
      }
      default:
        break;
    }
  }

  public async sendStateUpdate(
    activeTab: 'runner' | 'builder' = 'runner',
    activePresetId?: string,
  ): Promise<void> {
    const repos = await WorkspaceService.getWorkspaceRepos();
    const presets = await this.presetService.getPresets();
    const config = vscode.workspace.getConfiguration('workspaceManager');

    const update: ExtensionMessage = {
      type: 'stateUpdate',
      payload: {
        repos,
        presets,
        activePresetId,
        activeTab,
        settings: {
          reuseTerminals: config.get<boolean>('reuseTerminals', true),
          terminalPrefix: config.get<string>('terminalPrefix', '[WM]'),
        },
      },
    };

    this.postMessage(update);
  }

  private postMessage(message: ExtensionMessage): void {
    this.panel.webview.postMessage(message);
  }

  private getHtmlForWebview(): string {
    const { webview } = this.panel;
    const mediaUri = vscode.Uri.joinPath(this.extensionUri, 'media');
    const resourcesUri = vscode.Uri.joinPath(this.extensionUri, 'resources');

    const htmlPath = path.join(this.extensionUri.fsPath, 'media', 'dashboard.html');
    const cssPath = path.join(this.extensionUri.fsPath, 'media', 'dashboard.css');
    const jsPath = path.join(this.extensionUri.fsPath, 'media', 'dashboard.js');

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'dashboard.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'dashboard.js'));
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(resourcesUri, 'icon.png'));

    let template = '';
    if (fs.existsSync(htmlPath)) {
      template = fs.readFileSync(htmlPath, 'utf8');
    }

    let cssContent = '';
    if (fs.existsSync(cssPath)) {
      cssContent = fs.readFileSync(cssPath, 'utf8');
    }

    let jsContent = '';
    if (fs.existsSync(jsPath)) {
      jsContent = fs.readFileSync(jsPath, 'utf8');
    }

    return template
      .replace(/{{CSP_SOURCE}}/g, webview.cspSource)
      .replace(/{{CSS_URI}}/g, cssUri.toString())
      .replace(/{{JS_URI}}/g, jsUri.toString())
      .replace(/{{ICON_URI}}/g, iconUri.toString())
      .replace('/* {{INLINE_CSS}} */', cssContent)
      .replace('/* {{INLINE_JS}} */', jsContent);
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
