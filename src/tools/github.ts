import { exec } from 'child_process';
import { execCommand } from './execCommand';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const WORKSPACE_ROOT = join(process.cwd(), 'workspace');

function validateBranchName(name: string): void {
  if (name.startsWith('-') || name.startsWith(':')) {
    throw new Error('無効なブランチ名です');
  }
}

function writeTempFile(content: string, prefix: string): string {
  if (!existsSync(WORKSPACE_ROOT)) {
    mkdirSync(WORKSPACE_ROOT, { recursive: true });
  }
  const tempPath = join(WORKSPACE_ROOT, `${prefix}-${Date.now()}.txt`);
  writeFileSync(tempPath, content, 'utf-8');
  return tempPath;
}

export const createPullRequest = {
  name: 'createPullRequest',
  description: 'ghコマンドを使ってPRを作成する。既存PRがあれば更新',
  execute: async (args: {
    title: string;
    body: string;
    base: string;
    head: string;
  }) => {
    validateBranchName(args.head);
    validateBranchName(args.base);
    const checkResult = await execCommand.execute({
      command: `gh pr list --head ${args.head} --json number,title`
    });
    const existingPRs = JSON.parse(checkResult || '[]');

    const bodyFile = writeTempFile(args.body, 'pr-body');
    try {
      if (existingPRs.length > 0) {
        const prNumber = existingPRs[0].number;
        await execCommand.execute({
          command: `gh pr edit ${prNumber} --body-file ${bodyFile}`
        });
        return `既存のPR #${prNumber} を更新しました`
      } else {
        const cmd = `gh pr create --title "${args.title}" --body-file ${bodyFile} --base ${args.base} --head ${args.head}`;
        const result = await execCommand.execute({ command: cmd });
        return `PRを作成しました: ${result}`;
      }
    } finally {
      try { unlinkSync(bodyFile); } catch { /* ignore */ }
    }
  }
};

export const createIssueComment = {
  name: 'createIssueComment',
  description: 'Issueにコメントを投稿する',
  execute: async (args: { issueNumber: number; body: string }) => {
    const bodyFile = writeTempFile(args.body, 'issue-comment');
    try {
      const cmd = `gh issue comment ${args.issueNumber} --body-file ${bodyFile}`;
      await execCommand.execute({ command: cmd });
      return 'コメントを投稿しました';
    } finally {
      try { unlinkSync(bodyFile); } catch { /* ignore */ }
    }
  }
};