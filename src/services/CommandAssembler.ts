import { CommandOption } from '../types';

export class CommandAssembler {
  public static assembleCommand(
    baseCommand: string,
    options: CommandOption[] = [],
    userValues: Record<string, string> = {},
  ): string {
    let result = (baseCommand || '').trim();

    // First, interpolate any template placeholders like {message} or {env}
    for (const [key, val] of Object.entries(userValues)) {
      const placeholderRegex = new RegExp(`\\{${key}\\}`, 'g');
      if (placeholderRegex.test(result)) {
        result = result.replace(placeholderRegex, val);
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
