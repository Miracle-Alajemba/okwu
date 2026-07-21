import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  TranscriptChunk,
  SimplifiedCaption,
  HealthStatus,
  ConnectionState,
  CaptionEntry,
} from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

/**
 * Hook to manage Socket.IO connection to the Okwu backend.
 * Handles sending transcripts and receiving simplified captions.
 */
export function useSocket() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const streamingRef = useRef<string>('');
  const streamingIdRef = useRef<string>('');

  // Connect to server
  useEffect(() => {
    setConnectionState('connecting');

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected to server');
      setConnectionState('connected');
      // Request health status
      socket.emit('health:check');
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      setConnectionState('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setConnectionState('error');
    });

    // Handle health status
    socket.on('health:status', (status: HealthStatus) => {
      setHealth(status);
    });

    // Handle streaming tokens
    socket.on('caption:token', (token: string) => {
      streamingRef.current += token;
      setCaptions((prev) => {
        const updated = [...prev];
        const lastIdx = updated.findIndex(
          (c) => c.id === streamingIdRef.current
        );
        if (lastIdx !== -1) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            simplifiedText: streamingRef.current,
            isStreaming: true,
          };
        }
        return updated;
      });
    });

    // Handle completed caption
    socket.on('caption:done', (caption: SimplifiedCaption) => {
      setCaptions((prev) => {
        const updated = [...prev];
        const lastIdx = updated.findIndex(
          (c) => c.id === streamingIdRef.current
        );
        if (lastIdx !== -1) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            simplifiedText: caption.simplifiedText,
            processingTimeMs: caption.processingTimeMs,
            isStreaming: false,
          };
        }
        return updated;
      });
      streamingRef.current = '';
      streamingIdRef.current = '';
    });

    // Handle errors
    socket.on('error', (error: { message: string; code: string }) => {
      console.error('[Socket] Error:', error.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Send a raw transcript to the server for simplification
  const sendTranscript = useCallback((chunk: TranscriptChunk) => {
    if (!socketRef.current?.connected) {
      console.warn('[Socket] Not connected, cannot send transcript');
      return;
    }

    // Create a new caption entry in streaming state
    const id = `caption-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    streamingIdRef.current = id;
    streamingRef.current = '';

    setCaptions((prev) => [
      ...prev,
      {
        id,
        rawText: chunk.text,
        simplifiedText: '',
        processingTimeMs: 0,
        timestamp: chunk.timestamp,
        isStreaming: true,
      },
    ]);

    socketRef.current.emit('transcript:raw', chunk);
  }, []);

  // Clear all captions
  const clearCaptions = useCallback(() => {
    setCaptions([]);
  }, []);

  return {
    connectionState,
    health,
    captions,
    sendTranscript,
    clearCaptions,
  };
}
