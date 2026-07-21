import ollama from 'ollama';
import type { TranscriptChunk, SimplifiedCaption } from '../types/index.js';

/** The Gemma model to use — E2B is the smallest, fits in 8GB RAM */
const MODEL_NAME = 'gemma3:4b';

/**
 * System prompt that defines Okwu's core behavior.
 * This is the product — not just transcription, but intelligent simplification.
 */
const SYSTEM_PROMPT = `You are Okwu, a live captioning assistant for a deaf user.
You receive short chunks of transcribed speech. Your job is to output a short,
clear caption (max 12 words) that preserves meaning but drops filler words,
false starts, repetition, and verbal tics.

Rules:
- Output ONLY the simplified caption, nothing else
- Maximum 12 words per caption
- Preserve the core meaning — do not add information that wasn't said
- Drop: "um", "uh", "like", "you know", "basically", "so basically", false starts
- If the chunk is unclear or incomplete, output your best guess followed by "..."
- If the chunk is just noise or silence, output "[...]"
- Use simple, clear language
- Do not add quotation marks around your output

Examples:
Input: "So um basically what I'm trying to say is that uh the meeting has been moved to uh next week Tuesday"
Output: Meeting moved to next Tuesday

Input: "Can you please uh can you tell me where the where the pharmacy is located at"
Output: Where is the pharmacy?

Input: "The the the doctor said that um your your results came back and everything looks looks good"
Output: Doctor says your results look good`;

/**
 * Simplifies a raw transcript using Gemma via Ollama.
 * Returns the complete simplified caption.
 */
export async function simplifyTranscript(
  chunk: TranscriptChunk
): Promise<SimplifiedCaption> {
  const startTime = Date.now();

  try {
    const response = await ollama.chat({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: chunk.text },
      ],
      options: {
        temperature: 0.1, // Low temperature for consistent, predictable output
        top_p: 0.9,
        num_predict: 30, // Cap output length — captions should be short
      },
    });

    const processingTimeMs = Date.now() - startTime;

    return {
      rawText: chunk.text,
      simplifiedText: response.message.content.trim(),
      processingTimeMs,
      timestamp: Date.now(),
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    console.error('[GemmaSimplifier] Error:', error);

    return {
      rawText: chunk.text,
      simplifiedText: chunk.text, // Fallback: return raw text if Gemma fails
      processingTimeMs,
      timestamp: Date.now(),
    };
  }
}

/**
 * Simplifies a raw transcript using Gemma via Ollama with streaming.
 * Yields tokens as they're generated for real-time display.
 */
export async function* simplifyTranscriptStream(
  chunk: TranscriptChunk
): AsyncGenerator<string, SimplifiedCaption> {
  const startTime = Date.now();
  let fullText = '';

  try {
    const response = await ollama.chat({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: chunk.text },
      ],
      stream: true,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 30,
      },
    });

    for await (const part of response) {
      const token = part.message.content;
      fullText += token;
      yield token;
    }
  } catch (error) {
    console.error('[GemmaSimplifier] Stream error:', error);
    fullText = chunk.text; // Fallback to raw text
    yield chunk.text;
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    rawText: chunk.text,
    simplifiedText: fullText.trim(),
    processingTimeMs,
    timestamp: Date.now(),
  };
}

/**
 * Check if Ollama is running and the Gemma model is available.
 */
export async function checkGemmaHealth(): Promise<{
  ollama: boolean;
  gemmaLoaded: boolean;
  modelName: string;
}> {
  try {
    const models = await ollama.list();
    const gemmaModel = models.models.find((m) =>
      m.name.toLowerCase().includes('gemma')
    );

    return {
      ollama: true,
      gemmaLoaded: !!gemmaModel,
      modelName: gemmaModel?.name ?? MODEL_NAME,
    };
  } catch {
    return {
      ollama: false,
      gemmaLoaded: false,
      modelName: MODEL_NAME,
    };
  }
}

export { MODEL_NAME };
