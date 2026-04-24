import Anthropic from '@anthropic-ai/sdk';
import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  Provider,
  Message,
  ToolCall,
} from '../types';
import { LLMApiError } from '../types';

export function createAnthropic(config?: {
  apiKey?: string;
  maxRetries?: number;
}): Provider {
  const client = new Anthropic({
    apiKey: config?.apiKey,
    maxRetries: config?.maxRetries ?? 0,
  });

  function convertMessages(messages: Message[]) {
    return messages
      .filter((message) => message.role !== 'system')
      .map((message) => {
        if (message.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: message.toolCallId,
                content: message.content,
              },
            ],
          };
        }
        if (message.role === 'assistant' && message.toolCalls) {
          const content: any[] = [];
          if (message.content) {
            content.push({ type: 'text', text: message.content });
          }
          for (const toolCall of message.toolCalls) {
            content.push({
              type: 'tool_use',
              id: toolCall.toolCallId,
              name: toolCall.name,
              input: toolCall.args,
            });
          }
          return { role: 'assistant' as const, content };
        }
        return { role: message.role as 'user' | 'assistant', content: message.content };
      });
  }

  function mapFinishReason(
    stopReason: string | null
  ): GenerateTextResult['finishReason'] {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }

  return (modelId: string): LanguageModel => ({
    async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
      const systemMessages = params.messages.filter((message) => message.role === 'system');
      const system = systemMessages.map((systemMessage) => ({
        type: 'text' as const,
        text: systemMessage.content,
      }));

      const tools = params.tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object' as const,
          ...tool.parameters,
        },
      }));

      try {
        const response = await client.messages.create(
          {
            model: modelId,
            system,
            messages: convertMessages(params.messages),
            max_tokens: params.maxTokens ?? 4096,
            temperature: params.temperature,
            ...(tools && tools.length > 0 && { tools }),
          },
          { signal: params.signal }
        );

        const textBlocks = response.content.filter((b) => b.type === 'text');
        const text = textBlocks.map((b: any) => b.text).join('');

        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
        const toolCalls: ToolCall[] | undefined =
          toolUseBlocks.length > 0
            ? toolUseBlocks.map((b: any) => ({
              toolCallId: b.id,
              name: b.name,
              args: b.input,
            }))
            : undefined;

        return {
          text,
          finishReason: mapFinishReason(response.stop_reason),
          toolCalls,
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        };
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new LLMApiError(
            error.status,
            'anthropic',
            error.error?.type,
            error.message,
            error
          );
        }
        throw error;
      }
    },
  });
}