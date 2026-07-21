/**
 * Shared types used across client and server
 */

/** A raw transcript chunk from Whisper */
export interface TranscriptChunk {
  /** The raw transcribed text */
  text: string;
  /** Timestamp when the chunk was created (ms since epoch) */
  timestamp: number;
  /** Duration of the audio chunk in milliseconds */
  durationMs: number;
  /** Confidence score from Whisper (0-1) if available */
  confidence?: number;
}

/** A simplified caption from Gemma */
export interface SimplifiedCaption {
  /** The original raw transcript */
  rawText: string;
  /** Gemma's simplified caption */
  simplifiedText: string;
  /** Time taken for Gemma to process (ms) */
  processingTimeMs: number;
  /** Timestamp when the caption was generated */
  timestamp: number;
}

/** Socket.IO event types — Client → Server */
export interface ClientToServerEvents {
  /** Send a raw transcript chunk for simplification */
  'transcript:raw': (chunk: TranscriptChunk) => void;
  /** Request a health check */
  'health:check': () => void;
}

/** Socket.IO event types — Server → Client */
export interface ServerToClientEvents {
  /** Receive a simplified caption */
  'caption:simplified': (caption: SimplifiedCaption) => void;
  /** Receive streaming tokens as Gemma generates */
  'caption:token': (token: string) => void;
  /** Signal that a caption stream is complete */
  'caption:done': (caption: SimplifiedCaption) => void;
  /** Health check response */
  'health:status': (status: HealthStatus) => void;
  /** Error notification */
  'error': (error: { message: string; code: string }) => void;
}

/** Health status of the backend services */
export interface HealthStatus {
  /** Is the server running? */
  server: boolean;
  /** Is Ollama reachable? */
  ollama: boolean;
  /** Is the Gemma model loaded? */
  gemmaLoaded: boolean;
  /** Model name being used */
  modelName: string;
}
