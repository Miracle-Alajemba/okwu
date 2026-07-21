import { useEffect, useRef } from 'react';
import type { CaptionEntry } from '../types';

interface CaptionOverlayProps {
  captions: CaptionEntry[];
  showRawText: boolean;
  fontSize: number;
}

/**
 * CaptionOverlay — The hero UI component.
 * Displays live, simplified captions with smooth animations.
 */
export function CaptionOverlay({
  captions,
  showRawText,
  fontSize,
}: CaptionOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest caption
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [captions]);

  if (captions.length === 0) {
    return (
      <div className="caption-area">
        <div className="caption-area__empty">
          <div className="caption-area__empty-icon">👂</div>
          <p className="caption-area__empty-text">
            Tap the microphone button to start listening. Okwu will simplify
            speech into clear, easy-to-read captions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="caption-area">
      <div className="caption-area__scroll" ref={scrollRef}>
        {captions.map((caption) => (
          <div
            key={caption.id}
            className={`caption-card ${
              caption.isStreaming ? 'caption-card--streaming' : ''
            }`}
          >
            <div
              className="caption-card__simplified"
              style={{ fontSize: `${fontSize}rem` }}
            >
              {caption.simplifiedText || (caption.isStreaming ? '' : caption.rawText)}
            </div>

            {showRawText && caption.rawText && (
              <div className="caption-card__raw">
                Original: "{caption.rawText}"
              </div>
            )}

            {!caption.isStreaming && caption.processingTimeMs > 0 && (
              <div className="caption-card__meta">
                <span>⚡ {caption.processingTimeMs}ms</span>
                <span>•</span>
                <span>
                  {new Date(caption.timestamp).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
