export interface CommandOption {
  id: string;
  flag: string;
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
  isStandalone?: boolean;
  isSelfOption?: boolean;
}

export interface CommandPreset {
  id: string;
  name: string;
  description?: string;
  baseCommand: string;
  options: CommandOption[];
  targetRepoIds?: string[];
  repoOverrides?: Record<string, string>;
  executionMode?: 'parallel' | 'sequential';
  createdAt?: number;
  updatedAt?: number;
}

export interface WorkspaceRepo {
  id: string;
  name: string;
  path: string;
  isGitRepo: boolean;
  gitBranch?: string;
  isGitClean?: boolean;
  scripts: string[];
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  selected?: boolean;
  overrideCommand?: string;
}

export interface TargetExecution {
  repoId: string;
  repoPath: string;
  repoName: string;
  command: string;
}

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'refresh' }
  | {
    type: 'runCommand';
    payload: {
      presetId?: string;
      presetName?: string;
      baseCommand: string;
      assembledCommand: string;
      targets: TargetExecution[];
      mode: 'parallel' | 'sequential';
    };
  }
  | { type: 'savePreset'; payload: CommandPreset }
  | { type: 'deletePreset'; payload: { id: string } }
  | { type: 'openTerminal'; payload: { repoPath: string; repoName: string } }
  | { type: 'showNotice'; payload: { message: string; type?: 'info' | 'warning' | 'error' } };

export type ExtensionMessage =
  | {
    type: 'stateUpdate';
    payload: {
      repos: WorkspaceRepo[];
      presets: CommandPreset[];
      activePresetId?: string;
      activeTab?: 'runner' | 'builder';
      settings: {
        reuseTerminals: boolean;
        terminalPrefix: string;
      };
    };
  }
  | {
    type: 'executionSuccess';
    payload: {
      count: number;
      targets: TargetExecution[];
    };
  }
  | {
    type: 'executionError';
    payload: {
      message: string;
    };
  };
