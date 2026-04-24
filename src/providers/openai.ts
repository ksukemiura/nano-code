import OpenAI from 'openai';
import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  Provider,
  Message,
  ToolCall,
} from '../types';
import { LLMApiError } from '../types';

export function createOpenAI(config?: {
  apiKey?: string;
  baseURL?: string;
  maxRetries?: number;
}): Provider {
  const client = new OpenAI({
    apiKey: config?.apiKey,
    baseURL: config?.baseURL,
    maxRetries: config?.maxRetries ?? 0,
  });

  // const messages: Message[] = [
  //   { role: 'user', content: 'AIエージェントとは何ですか？' }
  // ];
  function convertMessages(messages: Message[]) {
    return messages.map((message) => {
      if (message.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: message.toolCallId,
          content: message.content,
        };
      }
      if (message.role === 'assistant' && message.toolCalls) {
        return {
          role: 'assistant' as const,
          content: message.content,
          tool_calls: message.toolCalls.map((toolCall) => ({
            id: toolCall.toolCallId,
            type: 'function' as const,
            function: { name: toolCall.name, arguments: JSON.stringify(toolCall.args) },
          })),
        };
      }
      return { role: message.role, content: message.content };
    });
  }

  function mapFinishReason(
    reason: string | null
  ): GenerateTextResult['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  return (modelId: string): LanguageModel => ({
    async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
      const tools = params.tools?.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      try {
        const completion = await client.chat.completions.create(
          {
            model: modelId,
            messages: convertMessages(params.messages),
            temperature: params.temperature,
            max_completion_tokens: params.maxTokens,
            ...(tools && tools.length > 0 && { tools }),
          },
          { signal: params.signal }
        );

        const choice = completion.choices[0];
        if (!choice) {
          throw new LLMApiError(
            500,
            'openai',
            undefined,
            'APIからの応答がありません',
          );
        }
        const message = choice.message;

        const toolCalls: ToolCall[] | undefined = message.tool_calls
          ?.filter((tool_call) => tool_call.type === 'function')
          ?.map((tool_call) => ({
            toolCallId: tool_call.id,
            name: tool_call.function.name,
            args: JSON.parse(tool_call.function.arguments),
          }));

        return {
          text: message.content ?? '',
          finishReason: mapFinishReason(choice.finish_reason),
          toolCalls,
          usage: {
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            totalTokens: completion.usage?.total_tokens,
          },
        };
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          throw new LLMApiError(
            error.status ?? 500,
            'openai',
            error.code ?? undefined,
            error.message,
            error
          );
        }
        throw error;
      }
    },
  });
}