import { useState, useCallback, useRef, useEffect } from 'react';
import type { WhisperProgress, TranscriptChunk } from '../types';

// We use dynamic import so the heavy transformers library only loads when needed
type Pipeline = Awaited<
  ReturnType<typeof import('@huggingface/transformers').then>
>['pipeline'];

/**
 * Hook to manage Whisper speech-to-text in the browser.
 * Uses @huggingface/transformers to run Whisper via WebAssembly.
 *
 * The model runs entirely in the browser — no server calls, true edge AI.
 */
export function useWhisper(onTranscript: (chunk: TranscriptChunk) => void) {
  const [progress, setProgress] = useState<WhisperProgress>({
    status: 'idle',
    progress: 0,
    message: 'Whisper not loaded',
  });
  const [isRecording, setIsRecording] = useState(false);

  // Refs for long-lived objects
  const pipelineRef = useRef<Awaited<ReturnType<Awaited<Pipeline>>> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  /**
   * Load the Whisper model. Called once on first use.
   * Downloads ~75MB model on first run, cached in browser after that.
   */
  const loadModel = useCallback(async () => {
    if (pipelineRef.current) return; // Already loaded

    setProgress({
      status: 'downloading',
      progress: 0,
      message: 'Downloading Whisper model...',
    });

    try {
      const { pipeline } = await import('@huggingface/transformers');

      const transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny.en',
        {
          dtype: 'q8',
          device: 'wasm', // Use WebAssembly — works on all browsers
          progress_callback: (progressData: {
            status: string;
            progress?: number;
            file?: string;
          }) => {
            if (progressData.status === 'progress' && progressData.progress) {
              setProgress({
                status: 'downloading',
                progress: Math.round(progressData.progress),
                message: `Downloading: ${progressData.file ?? 'model'}`,
              });
            }
          },
        }
      );

      pipelineRef.current = transcriber;

      setProgress({
        status: 'ready',
        progress: 100,
        message: 'Whisper ready — tap the mic to start',
      });
    } catch (error) {
      console.error('[Whisper] Failed to load model:', error);
      setProgress({
        status: 'error',
        progress: 0,
        message: `Failed to load Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, []);

  /**
   * Process accumulated audio buffer through Whisper
   */
  const processAudioChunk = useCallback(async () => {
    if (!pipelineRef.current || audioBufferRef.current.length === 0) return;

    // Merge all accumulated audio samples into one buffer
    const totalLength = audioBufferRef.current.reduce(
      (sum, buf) => sum + buf.length,
      0
    );
    if (totalLength === 0) return;

    const mergedBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of audioBufferRef.current) {
      mergedBuffer.set(buf, offset);
      offset += buf.length;
    }

    // Clear the buffer for the next chunk
    audioBufferRef.current = [];

    // Simple energy-based VAD: skip if audio is too quiet (likely silence)
    let energy = 0;
    for (let i = 0; i < mergedBuffer.length; i++) {
      energy += mergedBuffer[i] * mergedBuffer[i];
    }
    energy = energy / mergedBuffer.length;
    if (energy < 0.0001) return; // Silence threshold

    const startTime = Date.now();

    try {
      const result = await pipelineRef.current(mergedBuffer, {
        sampling_rate: 16000,
        language: 'en',
        return_timestamps: false,
      });

      const text =
        typeof result === 'string'
          ? result
          : Array.isArray(result)
            ? (result[0] as { text: string }).text
            : (result as { text: string }).text;

      const trimmedText = text?.trim();

      // Skip empty or very short results
      if (!trimmedText || trimmedText.length < 2) return;

      // Skip common Whisper hallucinations on silence
      const hallucinations = [
        'thank you',
        'thanks for watching',
        'you',
        'bye',
        'the end',
        '.',
      ];
      if (
        hallucinations.some((h) => trimmedText.toLowerCase() === h)
      )
        return;

      const chunk: TranscriptChunk = {
        text: trimmedText,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
      };

      onTranscript(chunk);
    } catch (error) {
      console.error('[Whisper] Transcription error:', error);
    }
  }, [onTranscript]);

  /**
   * Start recording from the microphone
   */
  const startRecording = useCallback(async () => {
    if (!pipelineRef.current) {
      await loadModel();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      // Create audio context at 16kHz (Whisper's expected sample rate)
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // Use ScriptProcessorNode to capture raw audio samples
      // (AudioWorklet would be cleaner but adds complexity)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!isRecordingRef.current) return;
        const inputData = event.inputBuffer.getChannelData(0);
        audioBufferRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Process audio every 4 seconds
      chunkIntervalRef.current = setInterval(processAudioChunk, 4000);

      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (error) {
      console.error('[Whisper] Failed to start recording:', error);
      setProgress({
        status: 'error',
        progress: 0,
        message: `Microphone error: ${error instanceof Error ? error.message : 'Permission denied'}`,
      });
    }
  }, [loadModel, processAudioChunk]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);

    // Process any remaining audio
    processAudioChunk();

    // Clean up interval
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }

    // Clean up audio
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    audioBufferRef.current = [];
  }, [processAudioChunk]);

  /**
   * Toggle recording on/off
   */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        stopRecording();
      }
    };
  }, [stopRecording]);

  return {
    progress,
    isRecording,
    loadModel,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
