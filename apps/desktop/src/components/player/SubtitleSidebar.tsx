import { useRef, useEffect } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { Subtitle } from '~/store/video';

interface SubtitleSidebarProps {
  subtitles: Subtitle[];
  currentIndex: number;
  onSeek: (time: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function SubtitleSidebar({
  subtitles,
  currentIndex,
  onSeek,
  isOpen,
  onToggle,
}: SubtitleSidebarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to active subtitle
  useEffect(() => {
    if (activeRef.current && listRef.current) {
      const container = listRef.current;
      const activeElement = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();

      const isVisible =
        activeRect.top >= containerRect.top &&
        activeRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentIndex]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={clsx(
          'absolute top-1/2 -translate-y-1/2 z-20 p-2 bg-gray-900/80 hover:bg-gray-800 rounded-l-lg transition-all',
          isOpen ? 'right-80' : 'right-0'
        )}
      >
        {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={clsx(
          'absolute top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur-sm border-l border-gray-800 transition-transform z-10',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-4 border-b border-gray-800">
          <h3 className="font-medium">Subtitles</h3>
          <p className="text-sm text-gray-400">
            {subtitles.length} lines • {currentIndex + 1} current
          </p>
        </div>

        <div ref={listRef} className="h-[calc(100%-80px)] overflow-y-auto">
          {subtitles.map((subtitle, index) => (
            <button
              key={subtitle.id}
              ref={index === currentIndex ? activeRef : null}
              onClick={() => onSeek(subtitle.startTime)}
              className={clsx(
                'w-full px-4 py-3 text-left border-b border-gray-800 transition-colors hover:bg-gray-800',
                index === currentIndex && 'bg-kairos-600/20 border-l-2 border-l-kairos-500'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                  {formatTime(subtitle.startTime)}
                </span>
                {index === currentIndex && (
                  <span className="text-xs px-2 py-0.5 bg-kairos-600 rounded">
                    Current
                  </span>
                )}
              </div>
              <p
                className={clsx(
                  'text-sm',
                  index === currentIndex ? 'text-white' : 'text-gray-300'
                )}
              >
                {subtitle.text}
              </p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
