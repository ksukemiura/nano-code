import { GoogleGenAI } from '@google/genai';
import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  Provider,
  Message,
  ToolCall,
} from '../types';
import { LLMApiError } from '../types';

export function createGoogle(config?: { apiKey?: string }): Provider {
  const client = new GoogleGenAI({
    apiKey: config?.apiKey,
  });

  function convertMessages(messages: Message[]) {
    return messages
      .filter((message) => message.role !== 'system')
      .map((message) => {
        if (message.role === 'tool') {
          return {
            role: 'user' as const,
            parts: [
              {
                functionResponse: {
                  name: message.name,
                  response: { result: message.content },
                },
              },
            ],
          };
        }
        if (message.role === 'assistant' && message.toolCalls) {
          const parts: any[] = [];
          if (message.content) {
            parts.push({ text: message.content });
          }
          for (const toolCall of message.toolCalls) {
            parts.push({
              functionCall: { name: toolCall.name, args: toolCall.args },
            });
          }
          return { role: 'model' as const, parts };
        }
        const role = message.role === 'assistant' ? 'model' : 'user';
        return { role: role as 'user' | 'model', parts: [{ text: message.content }] };
      });
  }

  function mapFinishReason(
    reason: string | undefined,
    hasFunctionCall: boolean
  ): GenerateTextResult['finishReason'] {
    if (hasFunctionCall) return 'tool_calls';
    switch (reason?.toUpperCase()) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  return (modelId: string): LanguageModel => ({
    async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
      const systemMessages = params.messages.filter((message) => message.role === 'system');
      const systemInstruction = systemMessages
        .map((systemMessage) => systemMessage.content)
        .join('\n');

      const tools = params.tools?.length
        ? [
          {
            functionDeclarations: params.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          },
        ]
        : undefined;

      try {
        const response = await client.models.generateContent({
          model: modelId,
          contents: convertMessages(params.messages),
          config: {
            systemInstruction,
            temperature: params.temperature,
            maxOutputTokens: params.maxTokens,
            ...(tools && { tools }),
          },
        });

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];

        const textParts = parts.filter((part: any) => part.text);
        const text = textParts.map((textPart: any) => textPart.text).join('');

        const functionCallParts = parts.filter((part: any) => part.functionCall);
        const toolCalls: ToolCall[] | undefined =
          functionCallParts.length > 0
            ? functionCallParts.map((p: any, i: number) => ({
              toolCallId: `call_${i}`,
              name: p.functionCall.name,
              args: p.functionCall.args,
            }))
            : undefined;

        return {
          text,
          finishReason: mapFinishReason(
            candidate?.finishReason,
            functionCallParts.length > 0
          ),
          toolCalls,
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount,
            completionTokens: response.usageMetadata?.candidatesTokenCount,
            totalTokens: response.usageMetadata?.totalTokenCount,
          },
        };
      } catch (error: any) {
        throw new LLMApiError(
          error.status ?? 500,
          'google',
          error.code,
          error.message,
          error
        );
      }
    },
  });
}