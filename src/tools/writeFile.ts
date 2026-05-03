import * as fs from 'fs/promises';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(process.cwd(), './workspace');

async function writeFileExecute(args: {
  path: string;
  content: string;
}): Promise<string> {
  const absolutePath = path.resolve(WORKSPACE_ROOT, args.path);

  const allowedPrefix = WORKSPACE_ROOT + path.sep;
  if (!absolutePath.startsWith(allowedPrefix) && absolutePath !== WORKSPACE_ROOT) {
    throw new Error(`アクセス拒否: ${args.path} はワークスペース外です`);
  }

  const dir = path.dirname(absolutePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(absolutePath, args.content, 'utf-8');

  return `ファイルを書き込みました: ${args.path}`;
}

export const writeFile = {
  name: "writeFile",
  description: "指定されたパスにファイルを作成または上書きする。ディレクトリが存在しない場合は自動的に作成される。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "書き込むファイルのパス",
      },
      content: {
        type: "string",
        description: "ファイルに書き込む内容",
      },
    },
    required: ["path", "content"],
  },
  execute: writeFileExecute,
};
