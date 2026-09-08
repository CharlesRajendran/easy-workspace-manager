import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CommandPreset } from '../types';
import { DEFAULT_PRESETS } from '../defaults';

const STORAGE_KEY = 'vsc_workspace_manager_presets';

export class PresetService {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public static getDefaultPresets(): CommandPreset[] {
    return DEFAULT_PRESETS;
  }

  public async getPresets(): Promise<CommandPreset[]> {
    const filePresets = this.loadFromFile();
    if (filePresets && filePresets.length > 0) {
      return filePresets;
    }

    const statePresets = this.context.workspaceState.get<CommandPreset[]>(STORAGE_KEY);
    if (statePresets && statePresets.length > 0) {
      return statePresets;
    }

    const defaults = PresetService.getDefaultPresets();
    await this.saveAll(defaults);
    return defaults;
  }

  public async savePreset(preset: CommandPreset): Promise<CommandPreset[]> {
    const presets = await this.getPresets();
    const existingIndex = presets.findIndex((p) => p.id === preset.id);

    const updatedPreset: CommandPreset = {
      ...preset,
      updatedAt: Date.now(),
      createdAt: preset.createdAt || Date.now(),
    };

    if (existingIndex >= 0) {
      presets[existingIndex] = updatedPreset;
    } else {
      presets.push(updatedPreset);
    }

    await this.saveAll(presets);
    return presets;
  }

  public async deletePreset(id: string): Promise<CommandPreset[]> {
    let presets = await this.getPresets();
    presets = presets.filter((p) => p.id !== id);
    await this.saveAll(presets);
    return presets;
  }

  private async saveAll(presets: CommandPreset[]): Promise<void> {
    await this.context.workspaceState.update(STORAGE_KEY, presets);
    this.saveToFile(presets);
  }

  private getConfigFileUri(): vscode.Uri | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    return vscode.Uri.file(path.join(folders[0].uri.fsPath, '.vscode', 'workspace-commands.json'));
  }

  private loadFromFile(): CommandPreset[] | null {
    try {
      const fileUri = this.getConfigFileUri();
      if (fileUri && fs.existsSync(fileUri.fsPath)) {
        const content = fs.readFileSync(fileUri.fsPath, 'utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed as CommandPreset[];
        }
        if (parsed.presets && Array.isArray(parsed.presets)) {
          return parsed.presets as CommandPreset[];
        }
      }
    } catch (e) {
      console.warn('Failed to read presets from workspace-commands.json', e);
    }
    return null;
  }

  private saveToFile(presets: CommandPreset[]): void {
    try {
      const fileUri = this.getConfigFileUri();
      if (!fileUri) {
        return;
      }
      const dirPath = path.dirname(fileUri.fsPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(fileUri.fsPath, JSON.stringify({ presets }, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to write presets to workspace-commands.json', e);
    }
  }
}
