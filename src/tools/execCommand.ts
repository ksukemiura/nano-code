import { spawn } from 'child_process';
import { channel } from 'diagnostics_channel';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(process.cwd(), './workspace');

const ALLOWED_COMMANDS = ['bun', 'ls', 'git', 'gh'];

const MAX_OUTPUT_LENGTH = 2048;

const dangerousChars = /[;&`$]/;

type Quote = '"' | "'" | null;

export function parseCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: Quote = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quote) {
      if (escaped) {
        current += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\' && quote === '"') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      current += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (quote) {
    throw new Error(`クォートが閉じられていません: ${quote}`);
  }
  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

async function execCommandExecute(args: { command: string }): Promise<string> {
  if (dangerousChars.test(args.command)) {
    throw new Error('コマンド連結・置換文字を含むコマンドは実行できません');
  }

  const parts = parseCommand(args.command);
  if (parts.length === 0) {
    throw new Error('コマンドが空です');
  }

  const commandName = parts[0];
  const commandArgs = parts.slice(1);

  if (!ALLOWED_COMMANDS.includes(commandName)) {
    throw new Error(`コマンド ${commandName} は許可されていません。許可されているコマンド: ${ALLOWED_COMMANDS.join(', ')}`);
  }

  for (const arg of commandArgs) {
    if (arg.includes('/') || arg.includes('//')) {
      const resolvedPath = path.resolve(WORKSPACE_ROOT, arg);
      if (!resolvedPath.startsWith(WORKSPACE_ROOT + path.sep) && resolvedPath !== WORKSPACE_ROOT) {
        throw new Error(`アクセス拒否: ${arg} はワークスペース外です`);
      }
    }
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let outputTruncated = false;

    const child = spawn(commandName, commandArgs, {
      cwd: WORKSPACE_ROOT,
      timeout: 30000,
      shell: false,
    });

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length > MAX_OUTPUT_LENGTH) {
        stdout += chunk.slice(0, MAX_OUTPUT_LENGTH - stdout.length);
        outputTruncated = true;
      } else {
        stdout += chunk;
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length > MAX_OUTPUT_LENGTH) {
        stderr += chunk.slice(0, MAX_OUTPUT_LENGTH - stderr.length);
        outputTruncated = true;
      } else {
        stderr += chunk;
      }
    });

    child.on('close', (code: number | null) => {
      let result = '';

      if (stdout) {
        result += stdout;
      }
      if (stderr) {
        result += (result ? '\n' : '') + `[stderr] ${stderr}`;
      }
      if (outputTruncated) {
        result += '\n...（出力が長いため省略されました）';
      }

      if (code !== 0) {
        result += `\n[終了コード: ${code}]`;
      }

      resolve(result || '（出力なし）');
    });

    child.on('error', (error: Error) => {
      reject(new Error(`コマンド実行エラー: ${error.message}`))
    });
  });
}

export const execCommand = {
  name: 'execCommand',
  description: 'ワークスペース内で許可された汎用コマンドを実行する。利用可能: bun test、ls、cat、grep、find、pwd、mkdir。',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '実行するコマンド（例: "bun test", "ls -la src/"）',
      },
    },
    required: ['command'],
  },
  execute: execCommandExecute,
};
