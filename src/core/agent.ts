import { generateText } from "./generate-text";
import { requestApproval } from "./approval";
import type { Message, Tool, LanguageModel } from "../types";

export interface AgentConfig {
  name: string;
  instructions: string;
  model: LanguageModel;
  tools: Record<string, Tool>;
  maxSteps?: number;
  verbose?: boolean;
  approvalFunc?: (toolName: string, args: any) => Promise<boolean>;
}

async function executeTool(tool: Tool, args: any): Promise<string> {
  try {
    return await tool.execute(args);
  } catch (error) {
    return `エラー: ${(error as Error).message}`;
  }
}

export class Agent {
  private name: string;
  private instructions: string;
  private model: LanguageModel;
  private tools: Tool[];
  private maxSteps: number;
  private verbose: boolean;
  private approvalFunc: (toolName: string, args: any) => Promise<boolean>;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.model = config.model;
    this.tools = Object.values(config.tools);
    this.maxSteps = config.maxSteps ?? 10;
    this.verbose = config.verbose ?? false;
    this.approvalFunc = config.approvalFunc ?? requestApproval;
  }

  async generate(userPrompt: string): Promise<{ text: string }> {
    let messages: Message[] = [
      { role: 'system', content: this.instructions },
      { role: 'user', content: userPrompt },
    ];

    let currentStep = 0;
    let finalText = '';
    let toolCallCount = 0;

    while (currentStep < this.maxSteps) {
      currentStep++;

      if (this.verbose) {
        console.log(`\n=== ステップ ${currentStep}/${this.maxSteps} ===`);
      }

      messages = this.manageContext(messages);

      const response = await generateText({
        model: this.model,
        messages,
        tools: this.tools,
      });

      if (response.text) {
        finalText = response.text;
        if (this.verbose) {
          console.log(`[応答] ${response.text}`);
        }
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: response.text,
          toolCalls: response.toolCalls,
        });

        for (const toolCall of response.toolCalls) {
          const tool = this.tools.find(tool => tool.name === toolCall.name);

          if (!tool) {
            messages.push({
              role: 'tool',
              toolCallId: toolCall.toolCallId,
              name: toolCall.name,
              content: `エラー: ツール ${toolCall.name} が見つかりません`,
            });
            continue;
          }

          if (this.verbose) {
            console.log(`[ツール実行] ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
          }

          if (tool.needsApproval) {
            const approved = await this.approvalFunc(toolCall.name, toolCall.args);
            if (!approved) {
              messages.push({
                role: 'tool',
                toolCallId: toolCall.toolCallId,
                name: toolCall.name,
                content: 'ユーザーによってキャンセルされました。別の方法を検討してください。',
              });
              continue;
            }
          }

          const result = await executeTool(tool, toolCall.args);
          toolCallCount++;

          if (this.verbose) {
            console.log(`[結果] ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`);
          }

          messages.push({
            role: 'tool',
            toolCallId: toolCall.toolCallId,
            name: toolCall.name,
            content: result,
          });
        }

        continue;
      }

      messages.push({
        role: 'assistant',
        content: response.text,
      });
      break;
    }

    if (currentStep >= this.maxSteps) {
      console.warn('警告: 最大ステップ数に達しました');
    }

    if (toolCallCount === 0 && currentStep === 1) {
      console.warn('警告: ツールが一度も使用されずに終了しました');
    }

    return { text: finalText };
  }

  private manageContext(messages: Message[]): Message[] {
    const CHAR_LIMIT = 30000;

    let totalLength = messages.reduce((sum, message) => sum + message.content.length, 0);

    if (totalLength < CHAR_LIMIT) {
      return messages;
    }

    console.log(`\n[Context] 会話履歴を圧縮します（現在: ${totalLength}文字）`);

    const systemMessage = messages[0];
    if (!systemMessage) {
      return messages;
    }

    const recentMessages = messages.slice(-4);
    let middleMessages = messages.slice(1, -4);

    middleMessages = middleMessages.map(message => {
      if (message.role === 'tool' && message.content.length > 200) {
        return {
          ...message,
          content: `（以前のツール実行結果は省略されました: ${message.content.length}文字）`
        };
      }
      return message;
    });

    totalLength = systemMessage.content.length +
                  middleMessages.reduce((sum, message) => sum + message.content.length, 0) +
                  recentMessages.reduce((sum, message) => sum + message.content.length, 0);

    while (totalLength > CHAR_LIMIT && middleMessages.length > 0) {
      const removed = middleMessages.shift();
      if (removed) {
        totalLength -= removed.content.length;
      }
    }

    return [systemMessage, ...middleMessages, ...recentMessages];
  }
}
