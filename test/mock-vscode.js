const Module = require('module');
const path = require('path');

const originalRequire = Module.prototype.require;

Module.prototype.require = function (moduleName) {
  if (moduleName === 'vscode') {
    return {
      workspace: {
        workspaceFolders: [],
        getConfiguration: () => ({
          get: (key, def) => def,
        }),
        onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
      },
      window: {
        terminals: [],
        createTerminal: (options) => ({
          name: options?.name || 'terminal',
          cwd: options?.cwd,
          sendText: () => {},
          show: () => {},
          dispose: () => {},
        }),
        showInformationMessage: () => Promise.resolve(),
        showWarningMessage: () => Promise.resolve(),
        showErrorMessage: () => Promise.resolve(),
        showQuickPick: () => Promise.resolve(),
        createStatusBarItem: () => ({ show: () => {}, dispose: () => {} }),
        registerTreeDataProvider: () => ({ dispose: () => {} }),
      },
      commands: {
        registerCommand: () => ({ dispose: () => {} }),
      },
      ThemeIcon: class {
        constructor(id) { this.id = id; }
      },
      TreeItem: class {
        constructor(label, collapsibleState) {
          this.label = label;
          this.collapsibleState = collapsibleState;
        }
      },
      TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
      StatusBarAlignment: { Left: 1, Right: 2 },
      ViewColumn: { One: 1, Two: 2 },
      EventEmitter: class {
        constructor() {
          this.listeners = [];
          this.event = (listener) => { this.listeners.push(listener); };
        }
        fire(data) { this.listeners.forEach((l) => l(data)); }
        dispose() {}
      },
      Uri: {
        file: (p) => ({ fsPath: p, toString: () => `file://${p}` }),
        joinPath: (base, ...segments) => {
          const fullPath = path.join(base.fsPath || '', ...segments);
          return { fsPath: fullPath, toString: () => `file://${fullPath}` };
        },
      },
    };
  }
  return originalRequire.apply(this, arguments);
};
