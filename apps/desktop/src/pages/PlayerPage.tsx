import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  ArrowLeft,
  Subtitles,
  Zap,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import clsx from 'clsx';

import { SubtitleOverlay } from '~/components/player/SubtitleOverlay';
import { SubtitleSidebar } from '~/components/player/SubtitleSidebar';
import { MiningModal } from '~/components/player/MiningModal';
import { useVideoStore } from '~/store/video';
import { useSettingsStore } from '~/store/settings';
import { useSubtitles } from '~/hooks/useSubtitles';

export function PlayerPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { currentVideo, addRecentVideo, updateVideoProgress } = useVideoStore();
  const { targetHSKLevel, autoSimplify, showPinyin, setAutoSimplify } = useSettingsStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);

  // Mining modal state
  const [miningWord, setMiningWord] = useState<string | null>(null);
  const [miningSentence, setMiningSentence] = useState<string>('');

  // Load subtitles
  const { subtitles, currentSubtitle, currentIndex } = useSubtitles({
    videoPath: currentVideo,
    currentTime,
  });

  // Convert local file path to Tauri asset URL
  const videoSrc = currentVideo ? convertFileSrc(currentVideo) : null;

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (isPlaying) {
        timeout = setTimeout(() => setShowControls(false), 3000);
      }
    };

    const container = containerRef.current;
    container?.addEventListener('mousemove', handleMouseMove);

    return () => {
      container?.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 's':
          e.preventDefault();
          setAutoSimplify(!autoSimplify);
          break;
        case 'Escape':
          if (miningWord) {
            setMiningWord(null);
          } else if (isFullscreen) {
            toggleFullscreen();
          } else {
            navigate('/');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen, autoSimplify, miningWord]);

  // Add to recent on load
  useEffect(() => {
    if (currentVideo) {
      addRecentVideo({
        path: currentVideo,
        name: currentVideo.split('/').pop() || 'Unknown',
        lastPlayed: new Date(),
        progress: 0,
      });
    }
  }, [currentVideo]);

  // Save progress periodically
  useEffect(() => {
    if (currentVideo && duration > 0) {
      const progress = currentTime / duration;
      updateVideoProgress(currentVideo, progress);
    }
  }, [currentTime, duration, currentVideo]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const skip = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    setVolume((prev) => Math.max(0, Math.min(1, prev + delta)));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleWordClick = useCallback((word: string, sentence: string) => {
    // Just show tooltip, don't open mining modal
    console.log('Word clicked:', word);
  }, []);

  const handleMineWord = useCallback((word: string, sentence: string) => {
    setMiningWord(word);
    setMiningSentence(sentence);
    // Pause video when mining
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  // Apply volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  if (!videoSrc) {
    navigate('/');
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="video-container h-screen bg-black flex"
    >
      {/* Video */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
        />

        {/* Subtitle overlay */}
        {currentSubtitle && (
          <SubtitleOverlay
            subtitle={currentSubtitle}
            simplified={autoSimplify ? undefined : undefined} // TODO: fetch simplified
            onWordClick={handleWordClick}
            onMineWord={handleMineWord}
          />
        )}

        {/* Controls overlay */}
        <div
          className={clsx(
            'absolute inset-0 transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="font-medium truncate">
                {currentVideo?.split('/').pop()}
              </h1>
            </div>
          </div>

          {/* Center play button (only when paused) */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={togglePlay}
                className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <Play size={40} className="ml-1" />
              </button>
            </div>
          )}

          {/* Bottom controls */}
          <div className="video-controls absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            {/* Progress bar */}
            <div className="mb-3">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-kairos-500"
              />
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={() => skip(-10)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Skip back 10s"
                >
                  <SkipBack size={20} />
                </button>
                <button
                  onClick={() => skip(10)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Skip forward 10s"
                >
                  <SkipForward size={20} />
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={toggleMute}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Time */}
                <span className="text-sm text-gray-400 ml-4">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Simplification toggle */}
                <button
                  onClick={() => setAutoSimplify(!autoSimplify)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    autoSimplify ? 'bg-kairos-600 text-white' : 'hover:bg-white/10'
                  )}
                  title="Toggle AI Simplification (S)"
                >
                  <Zap size={20} />
                </button>

                {/* Subtitles sidebar */}
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    showSidebar ? 'bg-white/20' : 'hover:bg-white/10'
                  )}
                  title="Subtitles & Mining"
                >
                  <Subtitles size={20} />
                </button>

                {/* Settings */}
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings size={20} />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtitle Sidebar */}
      <SubtitleSidebar
        subtitles={subtitles}
        currentIndex={currentIndex}
        onSeek={(time) => {
          if (videoRef.current) {
            videoRef.current.currentTime = time;
          }
        }}
        isOpen={showSidebar}
        onToggle={() => setShowSidebar(!showSidebar)}
      />

      {/* Mining Modal */}
      <MiningModal
        isOpen={!!miningWord}
        word={miningWord || ''}
        sentence={miningSentence}
        sourceTitle={currentVideo?.split('/').pop()}
        onClose={() => {
          setMiningWord(null);
          // Resume playback after closing
          if (videoRef.current) {
            videoRef.current.play();
          }
        }}
      />
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
