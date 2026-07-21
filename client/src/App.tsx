import { useState, useCallback } from 'react';
import { CaptionOverlay } from './components/CaptionOverlay';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useSocket } from './hooks/useSocket';
import { useWhisper } from './hooks/useWhisper';
import type { TranscriptChunk } from './types';

function App() {
  const [showRawText, setShowRawText] = useState(true);
  const [fontSize, setFontSize] = useState(2);
  const [showSettings, setShowSettings] = useState(false);

  // Socket.IO connection to backend (Gemma simplification)
  const { connectionState, health, captions, sendTranscript, clearCaptions } =
    useSocket();

  // Callback when Whisper produces a transcript
  const handleTranscript = useCallback(
    (chunk: TranscriptChunk) => {
      console.log('[App] Transcript:', chunk.text);
      sendTranscript(chunk);
    },
    [sendTranscript]
  );

  // Whisper speech-to-text (runs in browser)
  const { progress: whisperProgress, isRecording, toggleRecording, loadModel } =
    useWhisper(handleTranscript);

  // Handle mic button click
  const handleMicClick = useCallback(() => {
    if (whisperProgress.status === 'idle') {
      // First click: load the model, then start recording
      loadModel().then(() => {
        toggleRecording();
      });
    } else {
      toggleRecording();
    }
  }, [whisperProgress.status, loadModel, toggleRecording]);

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────── */}
      <header className="header" id="app-header">
        <div className="header__brand">
          <h1 className="header__logo">👂 Okwu</h1>
          <span className="header__tagline">
            Live captions, powered by Gemma
          </span>
        </div>
        <ConnectionStatus
          connectionState={connectionState}
          health={health}
          whisperProgress={whisperProgress}
        />
      </header>

      {/* ── Main Content — Captions ─────────────────── */}
      <main className="main" id="caption-area">
        {/* Loading overlay when Whisper is downloading */}
        {(whisperProgress.status === 'downloading' ||
          whisperProgress.status === 'loading') && (
          <div className="loading-overlay" id="loading-overlay">
            <div className="loading-overlay__logo">Okwu</div>
            <div className="loading-overlay__text">
              {whisperProgress.message}
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar__fill"
                style={{ width: `${whisperProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        <CaptionOverlay
          captions={captions}
          showRawText={showRawText}
          fontSize={fontSize}
        />
      </main>

      {/* ── Control Bar ─────────────────────────────── */}
      <div className="controls" id="controls">
        {/* Clear button */}
        <button
          className="control-button"
          onClick={clearCaptions}
          title="Clear captions"
          id="btn-clear"
          aria-label="Clear all captions"
        >
          🗑️
        </button>

        {/* Mic button — the primary action */}
        <button
          className={`mic-button ${
            isRecording ? 'mic-button--active' : 'mic-button--idle'
          }`}
          onClick={handleMicClick}
          id="btn-mic"
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          disabled={whisperProgress.status === 'downloading' || whisperProgress.status === 'loading'}
        >
          {isRecording ? '⏹️' : '🎙️'}
        </button>

        {/* Settings button */}
        <button
          className="control-button"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
          id="btn-settings"
          aria-label="Open settings"
        >
          ⚙️
        </button>
      </div>

      {/* ── Settings Panel ──────────────────────────── */}
      {showSettings && (
        <div
          className="settings-panel__backdrop settings-panel__backdrop--visible"
          onClick={() => setShowSettings(false)}
        />
      )}
      <div
        className={`settings-panel ${
          showSettings ? 'settings-panel--open' : ''
        }`}
        id="settings-panel"
      >
        <h2 className="settings-panel__title">Settings</h2>

        {/* Font Size */}
        <div className="settings-panel__group">
          <label className="settings-panel__label" htmlFor="font-size-slider">
            Caption Size: {fontSize.toFixed(1)}rem
          </label>
          <input
            type="range"
            id="font-size-slider"
            className="settings-panel__slider"
            min="1"
            max="4"
            step="0.25"
            value={fontSize}
            onChange={(e) => setFontSize(parseFloat(e.target.value))}
          />
        </div>

        {/* Show Raw Text Toggle */}
        <div className="settings-panel__toggle">
          <span className="settings-panel__label" style={{ marginBottom: 0 }}>
            Show Original Text
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showRawText}
              onChange={(e) => setShowRawText(e.target.checked)}
            />
            <span className="toggle-switch__slider" />
          </label>
        </div>

        {/* Connection Info */}
        <div className="settings-panel__group" style={{ marginTop: '2rem' }}>
          <label className="settings-panel__label">System Info</label>
          <div
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div>Server: {connectionState}</div>
            <div>Ollama: {health?.ollama ? '✅' : '❌'}</div>
            <div>Gemma: {health?.gemmaLoaded ? `✅ ${health.modelName}` : '❌'}</div>
            <div>Whisper: {whisperProgress.status}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
