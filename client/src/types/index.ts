/**
 * Shared types used across the Okwu client
 */

/** A raw transcript chunk from Whisper */
export interface TranscriptChunk {
  text: string;
  timestamp: number;
  durationMs: number;
  confidence?: number;
}

/** A simplified caption from Gemma */
export interface SimplifiedCaption {
  rawText: string;
  simplifiedText: string;
  processingTimeMs: number;
  timestamp: number;
}

/** Health status of backend services */
export interface HealthStatus {
  server: boolean;
  ollama: boolean;
  gemmaLoaded: boolean;
  modelName: string;
}

/** Whisper model loading progress */
export interface WhisperProgress {
  status: 'idle' | 'downloading' | 'loading' | 'ready' | 'error';
  progress: number; // 0-100
  message: string;
}

/** App connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Caption entry for display */
export interface CaptionEntry {
  id: string;
  rawText: string;
  simplifiedText: string;
  processingTimeMs: number;
  timestamp: number;
  isStreaming: boolean;
}
