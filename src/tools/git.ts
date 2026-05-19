import { execCommand } from './execCommand';

function validateBranchName(name: string): void {
  if (name.startsWith('-') || name.startsWith(':')) {
    throw new Error('無効なブランチ名形式です');
  }
}

export const createBranch = {
  name: 'createBranch',
  description: '新しいGitブランチを作成。既存ブランチがある場合は強制リセット',
  execute: async (args: { branchName: string }) => {
    validateBranchName(args.branchName);
    const result = await execCommand.execute({
      command: `git checkout -B ${args.branchName}`
    });
    return `ブランチを作成しました: ${args.branchName}\n${result}`;
  }
};

export const commit = {
  name: 'commitChanges',
  description: '変更をコミット',
  execute: async (args: { message: string; files: string[] }) => {
    const status = await execCommand.execute({
      command: 'git status --porcelain'
    });
    if (!status.trim()) {
      return 'コミットする必要がありません';
    }

    for (const file of args.files) {
      await execCommand.execute({ command: `git add "${file}"` });
    }
    const result = await execCommand.execute({
      command: `git commit -m "${args.message}"`
    });
    return `コミットしました: ${args.message}\n${result}`;
  }
};

export const pushBranch = {
  name: 'pushBranch',
  description: 'ブランチをリモートにプッシュ',
  execute: async (args: { branchName: string }) => {
    validateBranchName(args.branchName);
    const result = await execCommand.execute({
      command: `git push -u origin ${args.branchName}`
    });
    return `ブランチをプッシュしました: ${args.branchName}\n${result}`;
  }
};