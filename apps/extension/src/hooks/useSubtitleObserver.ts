import { useState, useEffect, useCallback } from 'react';

interface UseSubtitleObserverOptions {
  platform: 'netflix' | 'youtube';
  selector: string;
}

interface SubtitleObserverResult {
  subtitleText: string | null;
  isVisible: boolean;
  error: Error | null;
}

/**
 * Hook to observe subtitle changes on video platforms
 */
export function useSubtitleObserver({
  platform,
  selector,
}: UseSubtitleObserverOptions): SubtitleObserverResult {
  const [subtitleText, setSubtitleText] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Extract text from subtitle elements
  const extractText = useCallback(
    (container: Element): string | null => {
      if (platform === 'netflix') {
        // Netflix uses multiple span elements
        const spans = container.querySelectorAll('span');
        if (spans.length === 0) return null;

        const text = Array.from(spans)
          .map((span) => span.textContent)
          .filter(Boolean)
          .join('');

        return text.trim() || null;
      } else if (platform === 'youtube') {
        // YouTube uses caption segments
        const segments = container.querySelectorAll('.ytp-caption-segment');
        if (segments.length === 0) {
          // Fallback to direct text content
          return container.textContent?.trim() || null;
        }

        const text = Array.from(segments)
          .map((seg) => seg.textContent)
          .filter(Boolean)
          .join(' ');

        return text.trim() || null;
      }

      return null;
    },
    [platform]
  );

  // Check if text contains Chinese characters
  const containsChinese = (text: string): boolean => {
    return /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}]/u.test(text);
  };

  useEffect(() => {
    let observer: MutationObserver | null = null;

    const setupObserver = () => {
      try {
        // Find the subtitle container based on platform
        let subtitleContainer: Element | null = null;

        if (platform === 'netflix') {
          subtitleContainer = document.querySelector('.player-timedtext');
        } else if (platform === 'youtube') {
          subtitleContainer = document.querySelector('.ytp-caption-window-container');
        }

        if (!subtitleContainer) {
          // Container not found yet, retry
          setTimeout(setupObserver, 1000);
          return;
        }

        // Create observer for subtitle changes
        observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            // Check for added nodes
            if (mutation.addedNodes.length > 0) {
              const container = document.querySelector(selector);
              if (container) {
                const text = extractText(container.parentElement || container);
                if (text && containsChinese(text)) {
                  setSubtitleText(text);
                  setIsVisible(true);
                }
              }
            }

            // Check for removed nodes (subtitle hidden)
            if (mutation.removedNodes.length > 0) {
              const container = document.querySelector(selector);
              if (!container) {
                setIsVisible(false);
              }
            }

            // Check for character data changes
            if (mutation.type === 'characterData') {
              const text = mutation.target.textContent;
              if (text && containsChinese(text)) {
                setSubtitleText(text);
                setIsVisible(true);
              }
            }
          }
        });

        // Observe the subtitle container
        observer.observe(subtitleContainer, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        // Initial check for existing subtitles
        const existingSubtitle = document.querySelector(selector);
        if (existingSubtitle) {
          const text = extractText(existingSubtitle.parentElement || existingSubtitle);
          if (text && containsChinese(text)) {
            setSubtitleText(text);
            setIsVisible(true);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to observe subtitles'));
      }
    };

    // Start observing after a short delay to ensure page is loaded
    const timeoutId = setTimeout(setupObserver, 500);

    return () => {
      clearTimeout(timeoutId);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [platform, selector, extractText]);

  return { subtitleText, isVisible, error };
}
