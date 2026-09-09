import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import * as path from 'path';
import * as fs from 'fs';
import { CommandAssembler } from '../src/services/CommandAssembler';
import { DEFAULT_PRESETS } from '../src/defaults';
import { CommandOption } from '../src/types';
import { WorkspaceService } from '../src/services/WorkspaceService';
import { TerminalRunner } from '../src/services/TerminalRunner';

describe('CommandAssembler & Command Assembly Tests', () => {
  it('should assemble basic command without options', () => {
    const cmd = CommandAssembler.assembleCommand('npm start', [], {});
    assert.equal(cmd, 'npm start');
  });

  it('should format flags and quote arguments containing spaces', () => {
    const options: CommandOption[] = [
      { id: 'm', flag: '-m', placeholder: 'Enter commit message', required: true },
    ];
    const userValues = { m: 'feat: add multi repo runner' };

    const cmd = CommandAssembler.assembleCommand('git commit', options, userValues);
    assert.equal(cmd, 'git commit -m "feat: add multi repo runner"');
  });

  it('should escape internal double quotes in arguments', () => {
    const options: CommandOption[] = [
      { id: 'm', flag: '-m', placeholder: 'Enter message' },
    ];
    const userValues = { m: 'fix: handle "null" pointer safely' };

    const cmd = CommandAssembler.assembleCommand('git commit', options, userValues);
    assert.equal(cmd, 'git commit -m "fix: handle \\"null\\" pointer safely"');
  });

  it('should interpolate in-line template placeholders like {message}', () => {
    const cmd = CommandAssembler.assembleCommand(
      'git commit -m "{message}"',
      [],
      { message: 'release v1.0.0' },
    );
    assert.equal(cmd, 'git commit -m "release v1.0.0"');
  });

  it('should assemble multiple flags cleanly', () => {
    const options: CommandOption[] = [
      { id: 'env', flag: '--env', placeholder: 'Environment' },
      { id: 'port', flag: '--port', placeholder: 'Port number' },
    ];
    const userValues = { env: 'staging', port: '8080' };

    const cmd = CommandAssembler.assembleCommand('npm run deploy', options, userValues);
    assert.equal(cmd, 'npm run deploy --env staging --port 8080');
  });

  it('should omit empty optional options', () => {
    const options: CommandOption[] = [
      { id: 'filter', flag: '--filter', placeholder: 'Filter query' },
    ];
    const userValues = { filter: '   ' };

    const cmd = CommandAssembler.assembleCommand('npm test', options, userValues);
    assert.equal(cmd, 'npm test');
  });

  it('should extract embedded template placeholders accurately', () => {
    const vars1 = CommandAssembler.extractPlaceholders('git pull origin {branch}');
    assert.deepEqual(vars1, ['branch']);

    const vars2 = CommandAssembler.extractPlaceholders('docker build -t {image}:{tag} -f {dockerfile} .');
    assert.deepEqual(vars2, ['image', 'tag', 'dockerfile']);

    const vars3 = CommandAssembler.extractPlaceholders('run {service:port}');
    assert.deepEqual(vars3, ['service:port']);

    // Should ignore non-matching syntax like spaces or bash variables
    const vars4 = CommandAssembler.extractPlaceholders("awk '{print $1}' && echo ${VAR} && echo {}");
    assert.deepEqual(vars4, []);
  });

  it('should interpolate dynamic branch in git pull origin {branch}', () => {
    const cmd = CommandAssembler.assembleCommand(
      'git pull origin {branch}',
      [],
      { branch: 'develop' },
    );
    assert.equal(cmd, 'git pull origin develop');
  });

  it('should combine embedded template variables and option flags', () => {
    const options: CommandOption[] = [
      { id: 'rebase', flag: '--rebase', placeholder: 'Rebase' },
    ];
    const cmd = CommandAssembler.assembleCommand(
      'git pull origin {branch}',
      options,
      { branch: 'feature/auth', rebase: 'true' },
    );
    assert.equal(cmd, 'git pull origin feature/auth --rebase true');
  });

  it('should fallback to repo context variables if not overridden', () => {
    const cmd = CommandAssembler.assembleCommand(
      'echo "Building {repoName} on {gitBranch}"',
      [],
      {},
      { repoName: 'web-frontend', gitBranch: 'main' },
    );
    assert.equal(cmd, 'echo "Building web-frontend on main"');
  });
});

describe('WorkspaceService & Project Discovery Tests', () => {
  const fixtureBase = path.resolve(__dirname, 'fixtures/example-workspace/services');

  it('should inspect web-frontend repository correctly', () => {
    const projectPath = path.join(fixtureBase, 'web-frontend');
    const gitDir = path.join(projectPath, '.git');
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');

    const repo = WorkspaceService.inspectFolder(projectPath, 'web-frontend');
    fs.rmSync(gitDir, { recursive: true, force: true });

    assert.equal(repo.name, 'web-frontend');
    assert.equal(repo.isGitRepo, true);
    assert.equal(repo.gitBranch, 'main');
    assert.deepEqual(repo.scripts, ['start', 'build', 'test']);
  });

  it('should inspect api-backend repository correctly', () => {
    const projectPath = path.join(fixtureBase, 'api-backend');
    const gitDir = path.join(projectPath, '.git');
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/develop\n');

    const repo = WorkspaceService.inspectFolder(projectPath, 'api-backend');
    fs.rmSync(gitDir, { recursive: true, force: true });

    assert.equal(repo.name, 'api-backend');
    assert.equal(repo.isGitRepo, true);
    assert.equal(repo.gitBranch, 'develop');
    assert.deepEqual(repo.scripts, ['start', 'dev', 'test']);
  });

  it('should inspect docs-site repository correctly', () => {
    const projectPath = path.join(fixtureBase, 'docs-site');
    const gitDir = path.join(projectPath, '.git');
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/feature/docs-v2\n');

    const repo = WorkspaceService.inspectFolder(projectPath, 'docs-site');
    fs.rmSync(gitDir, { recursive: true, force: true });

    assert.equal(repo.name, 'docs-site');
    assert.equal(repo.isGitRepo, true);
    assert.equal(repo.gitBranch, 'feature/docs-v2');
    assert.deepEqual(repo.scripts, ['serve', 'build']);
  });
});

describe('TerminalRunner Multi-Target Dispatch Tests', () => {
  it('should dispatch execution across selected targets', async () => {
    const targets = [
      {
        repoId: 'repo-1',
        repoPath: '/tmp/repo1',
        repoName: 'repo1',
        command: 'npm start',
      },
      {
        repoId: 'repo-2',
        repoPath: '/tmp/repo2',
        repoName: 'repo2',
        command: 'ng serve',
      },
    ];

    await TerminalRunner.executeAcrossTargets(targets, 'parallel');
    // Verifies no exception thrown during terminal creation and text dispatch
    assert.ok(true);
  });
});

describe('Default Presets Tests', () => {
  it('should provide valid default presets', () => {
    assert.ok(DEFAULT_PRESETS.length >= 4);

    const devPreset = DEFAULT_PRESETS.find((p) => p.id === 'dev-start-all');
    assert.ok(devPreset);
    assert.equal(devPreset?.baseCommand, 'npm start');
    assert.equal(devPreset?.executionMode, 'parallel');

    const commitPreset = DEFAULT_PRESETS.find((p) => p.id === 'git-bulk-commit');
    assert.ok(commitPreset);
    assert.equal(commitPreset?.baseCommand, 'git commit');
    assert.equal(commitPreset?.options.length, 1);
    assert.equal(commitPreset?.options[0].flag, '-m');

    const branchPreset = DEFAULT_PRESETS.find((p) => p.id === 'git-pull-branch');
    assert.ok(branchPreset);
    assert.equal(branchPreset?.baseCommand, 'git pull origin {branch}');
  });
});
