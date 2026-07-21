import type { ConnectionState, HealthStatus, WhisperProgress } from '../types';

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  health: HealthStatus | null;
  whisperProgress: WhisperProgress;
}

/**
 * Shows the connection status of all services:
 * - Backend server
 * - Ollama / Gemma
 * - Whisper model
 */
export function ConnectionStatus({
  connectionState,
  health,
  whisperProgress,
}: ConnectionStatusProps) {
  const getServerStatus = () => {
    if (connectionState === 'connected' && health?.server) {
      return { dot: 'status-dot--active', label: 'Server' };
    }
    if (connectionState === 'connecting') {
      return { dot: 'status-dot--loading', label: 'Connecting...' };
    }
    return { dot: 'status-dot--error', label: 'Server offline' };
  };

  const getGemmaStatus = () => {
    if (health?.gemmaLoaded) {
      return { dot: 'status-dot--active', label: 'Gemma' };
    }
    if (health?.ollama) {
      return { dot: 'status-dot--warning', label: 'Gemma loading...' };
    }
    return { dot: 'status-dot--error', label: 'Ollama offline' };
  };

  const getWhisperStatus = () => {
    switch (whisperProgress.status) {
      case 'ready':
        return { dot: 'status-dot--active', label: 'Whisper' };
      case 'downloading':
      case 'loading':
        return { dot: 'status-dot--loading', label: `${whisperProgress.progress}%` };
      case 'error':
        return { dot: 'status-dot--error', label: 'Whisper error' };
      default:
        return { dot: 'status-dot--warning', label: 'Whisper idle' };
    }
  };

  const server = getServerStatus();
  const gemma = getGemmaStatus();
  const whisper = getWhisperStatus();

  return (
    <div className="header__status">
      <div className="status-badge">
        <span className={`status-dot ${whisper.dot}`} />
        <span>{whisper.label}</span>
      </div>
      <div className="status-badge">
        <span className={`status-dot ${gemma.dot}`} />
        <span>{gemma.label}</span>
      </div>
      <div className="status-badge">
        <span className={`status-dot ${server.dot}`} />
        <span>{server.label}</span>
      </div>
    </div>
  );
}
