import { writeFile } from "../src/tools/writeFile";
import { readFile } from "../src/tools/readFile";
import { editFile } from "../src/tools/editFile";
import { execCommand } from "../src/tools/execCommand";

async function demo() {
  console.log('=== ツール動作確認 ===\n');

  console.log('1. writeFile: テストファイルを作成');
  const writeResult = await writeFile.execute({
    path: 'test.txt',
    content: 'Hello from Nano Code!\nThis is a test file.',
  });
  console.log(`結果: ${writeResult}\n`);

  console.log('2. readFile: 作成したファイルを読み込み');
  const content = await readFile.execute({ path: 'test.txt' });
  console.log(`内容:\n${content.replace(/\n/g, '\n  ')}\n`);

  console.log('3. editFile: ファイルの一部を編集');
  const editResult = await editFile.execute({
    path: 'test.txt',
    oldText: 'Hello from Nano Code!',
    newText: 'Hello from Nano Code Agent!',
  });
  console.log(`結果: ${editResult}\n`);

  console.log('4. readFile: 編集後のファイルを確認');
  const editContent = await readFile.execute({ path: 'test.txt' });
  console.log(`内容:\n${content.replace(/\n/g, '\n  ')}\n`);

  console.log('5. execCommand: ワークスペースのファイル一覧');
  const lsResult = await execCommand.execute({ command: 'ls -la' });
  console.log(`結果:\n${lsResult}\n`);

  console.log('6. エラーケース: 存在しないファイルの読み込み');
  try {
    await readFile.execute({ path: 'nonexistent.txt' });
  } catch (error) {
    console.log(`期待通りのエラー: ${error.message}\n`);
  }

  console.log('7. セキュリティチェック: ワークスペース外へのアクセス');
  try {
    await readFile.execute({ path: '../.env' });
  } catch (error) {
    console.log(`期待通りのエラー: ${error.message}\n`);
  }

  console.log('=== 動作確認完了 ===\n');
}

demo().catch(console.error);
