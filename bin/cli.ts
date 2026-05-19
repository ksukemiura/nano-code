import * as path from 'path';
import { Agent } from '../src/core/agent';
import { loadInstructions } from '../src/core/prompt';
import { createModelFromEnv } from '../src/providers/modelFactory';
import { readFile } from '../src/tools/readFile';
import { writeFile } from '../src/tools/writeFile';
import { editFile } from '../src/tools/editFile';
import { execCommand } from '../src/tools/execCommand';

async function main() {
  const args = process.argv.slice(2);

  if (args.length == 0) {
    console.error('使い方: bun run agent "<タスクの説明>"')
    console.error('例: bun run agent "calculator.ts の関数にテストを追加してください"');
    process.exit(1);
  }

  const userPrompt = args.join(' ');

  const model = createModelFromEnv();

  const workspaceRoot = path.resolve(process.cwd(), 'workspace');

  const instructions = loadInstructions(workspaceRoot);

  const agent = new Agent({
    name: 'nano-code',
    model,
    instructions,
    tools: {
      readFile,
      writeFile,
      editFile,
      execCommand,
    },
    maxSteps: 15
  });

  console.log('エージェント起動\n');
  console.log(`タスク: ${userPrompt}\n`);
  console.log('-'.repeat(60) + '\n');

  try {
    const result = await agent.generate(userPrompt);
    console.log(result.text);
    console.log('\n' + '-'.repeat(60));
    console.log('タスク完了');
  } catch (error) {
    console.error('\n予測しないエラー:', error);
    process.exit(1);
  }
}

main();
