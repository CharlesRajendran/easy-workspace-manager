import { CommandOption } from '../types';

export class CommandAssembler {
  public static extractPlaceholders(command: string): string[] {
    if (!command) {
      return [];
    }
    const matches = command.match(/(?<!\$)\{([a-zA-Z0-9_:.-]+)\}/g);
    if (!matches) {
      return [];
    }
    return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
  }

  public static assembleCommand(
    baseCommand: string,
    options: CommandOption[] = [],
    userValues: Record<string, string> = {},
    repoContext?: { repoName?: string; repoPath?: string; gitBranch?: string },
  ): string {
    let result = (baseCommand || '').trim();

    // First, interpolate any template placeholders like {branch} or {message}
    for (const [key, rawVal] of Object.entries(userValues)) {
      const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const placeholderRegex = new RegExp(`\\{${escapedKey}\\}`, 'g');
      if (placeholderRegex.test(result)) {
        result = result.replace(placeholderRegex, () => val);
      }
    }

    // Contextual fallback tokens if not provided in userValues
    if (repoContext) {
      if (repoContext.repoName && !userValues.repo && !userValues.repoName) {
        result = result.replace(/\{repo\}/g, () => repoContext.repoName || '');
        result = result.replace(/\{repoName\}/g, () => repoContext.repoName || '');
      }
      if (repoContext.repoPath && !userValues.repoPath) {
        result = result.replace(/\{repoPath\}/g, () => repoContext.repoPath || '');
      }
      if (repoContext.gitBranch && !userValues.gitBranch && !userValues.branch) {
        result = result.replace(/\{gitBranch\}/g, () => repoContext.gitBranch || '');
      }
    }

    // Next, append any defined options that weren't placeholders in the baseCommand
    options.forEach((opt) => {
      const rawVal = userValues[opt.id] ?? opt.defaultValue ?? '';
      const val = rawVal.trim();

      const alreadyInBase = result.includes(`{${opt.id}}`)
        || (opt.flag && result.includes(opt.flag));

      if (val && !alreadyInBase) {
        const escaped = val.replace(/"/g, '\\"');
        const formattedVal = val.includes(' ') || val.includes('\n') ? `"${escaped}"` : val;

        if (opt.flag) {
          result = `${result} ${opt.flag} ${formattedVal}`;
        } else {
          result = `${result} ${formattedVal}`;
        }
      }
    });

    return result.trim();
  }
}
