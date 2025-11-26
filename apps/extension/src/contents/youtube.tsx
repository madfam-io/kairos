import type { PlasmoCSConfig, PlasmoGetOverlayAnchor } from 'plasmo';
import { useEffect, useState } from 'react';
import { useStorage } from '@plasmohq/storage/hook';
import { sendToBackground } from '@plasmohq/messaging';

import { SubtitleOverlay } from '~/components/SubtitleOverlay';
import { useSubtitleObserver } from '~/hooks/useSubtitleObserver';
import type { UserSettings } from '@kairos/types';

import '~/style.css';

export const config: PlasmoCSConfig = {
  matches: ['https://*.youtube.com/*'],
  world: 'MAIN',
  run_at: 'document_idle',
};

// Mount overlay inside YouTube's video container
export const getOverlayAnchor: PlasmoGetOverlayAnchor = async () => {
  const waitForElement = (selector: string, timeout = 10000): Promise<Element | null> => {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  };

  // YouTube video container
  const videoContainer = await waitForElement('#movie_player');
  return videoContainer;
};

export const getStyle = () => {
  const style = document.createElement('style');
  style.textContent = `
    .plasmo-csui-container {
      position: absolute !important;
      bottom: 80px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }
    .plasmo-csui-container > * {
      pointer-events: auto !important;
    }
  `;
  return style;
};

function YouTubeOverlay() {
  const [settings] = useStorage<UserSettings>('settings');
  const [isActive, setIsActive] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);

  // Observe YouTube caption changes
  const { subtitleText, isVisible } = useSubtitleObserver({
    platform: 'youtube',
    selector: '.ytp-caption-segment',
  });

  useEffect(() => {
    if (subtitleText) {
      setCurrentSubtitle(subtitleText);
    }
  }, [subtitleText]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!settings?.keyboardShortcutsEnabled) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 's':
          sendToBackground({ name: 'toggle-simplification' });
          break;
        case 'm':
          sendToBackground({
            name: 'mine-word',
            body: { subtitle: currentSubtitle },
          });
          break;
        case 'p':
          sendToBackground({ name: 'toggle-pinyin' });
          break;
        case 'r':
          sendToBackground({ name: 'replay-audio' });
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [settings?.keyboardShortcutsEnabled, currentSubtitle]);

  if (!isActive || !isVisible || !currentSubtitle) {
    return null;
  }

  return (
    <SubtitleOverlay
      text={currentSubtitle}
      settings={settings}
      platform="youtube"
      onWordClick={(word, sentence) => {
        sendToBackground({
          name: 'word-clicked',
          body: { word, sentence },
        });
      }}
      onMine={(word, sentence) => {
        sendToBackground({
          name: 'mine-word',
          body: { word, sentence },
        });
      }}
    />
  );
}

export default YouTubeOverlay;
