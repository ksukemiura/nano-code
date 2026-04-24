import { createOpenAI } from '../src/providers/openai';
import { createAnthropic } from '../src/providers/anthropic';
import { createGoogle } from '../src/providers/google';
import { generateText } from '../src/core/generate-text';
import type { Message } from '../src/types';

const messages: Message[] = [
  { role: 'user', content: 'AIエージェントとは何ですか？' }
];

const openai = createOpenAI();
const result1 = await generateText({ model: openai('gpt-5-mini'), messages });
console.log('OpenAI:', result1.text);

const anthropic = createAnthropic();
const result2 = await generateText({ model: anthropic('claude-haiku-4-5-20251001'), messages });
console.log('Anthropic:', result2.text);

const google = createGoogle();
const result3 = await generateText({ model: google('gemini-2.5-flash'), messages });
console.log('Google:', result3.text);