import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceRepo } from '../types';

export class WorkspaceService {
  public static async getWorkspaceRepos(): Promise<WorkspaceRepo[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return [];
    }

    return folders.map((folder) => WorkspaceService.inspectFolder(
      folder.uri.fsPath,
      folder.name,
      folder.uri.toString(),
    ));
  }

  public static inspectFolder(
    folderPath: string,
    folderName: string,
    repoId?: string,
  ): WorkspaceRepo {
    const id = repoId || folderPath;

    // Check Git status
    const gitDir = path.join(folderPath, '.git');
    const isGitRepo = fs.existsSync(gitDir);
    let gitBranch: string | undefined;

    if (isGitRepo) {
      gitBranch = WorkspaceService.readGitBranch(gitDir);
    }

    // Check package.json and scripts
    const packageJsonPath = path.join(folderPath, 'package.json');
    const scripts: string[] = [];
    let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' = 'npm';

    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = fs.readFileSync(packageJsonPath, 'utf8');
        const pkg = JSON.parse(content);
        if (pkg.scripts && typeof pkg.scripts === 'object') {
          scripts.push(...Object.keys(pkg.scripts));
        }
      } catch (e) {
        console.warn(`Failed to parse package.json in ${folderPath}`, e);
      }

      // Detect package manager
      if (fs.existsSync(path.join(folderPath, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm';
      } else if (fs.existsSync(path.join(folderPath, 'yarn.lock'))) {
        packageManager = 'yarn';
      } else if (fs.existsSync(path.join(folderPath, 'bun.lockb'))) {
        packageManager = 'bun';
      }
    }

    return {
      id,
      name: folderName,
      path: folderPath,
      isGitRepo,
      gitBranch,
      scripts,
      packageManager,
      selected: true,
    };
  }

  public static readGitBranch(gitDir: string): string | undefined {
    try {
      let headPath = path.join(gitDir, 'HEAD');
      if (!fs.existsSync(headPath) && fs.statSync(gitDir).isFile()) {
        const gitPointer = fs.readFileSync(gitDir, 'utf8').trim();
        if (gitPointer.startsWith('gitdir:')) {
          const realGitDir = path.resolve(
            path.dirname(gitDir),
            gitPointer.replace('gitdir:', '').trim(),
          );
          headPath = path.join(realGitDir, 'HEAD');
        }
      }

      if (fs.existsSync(headPath)) {
        const headContent = fs.readFileSync(headPath, 'utf8').trim();
        if (headContent.startsWith('ref: refs/heads/')) {
          return headContent.replace('ref: refs/heads/', '');
        }
        return headContent.substring(0, 7);
      }
    } catch (err) {
      console.warn('Could not determine git branch', err);
    }
    return undefined;
  }
}
