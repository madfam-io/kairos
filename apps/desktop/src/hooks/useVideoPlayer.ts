import { useState, useRef, useCallback, useEffect } from 'react';
import { useVideoStore } from '~/store/video';

interface UseVideoPlayerOptions {
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
}

interface UseVideoPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isFullscreen: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  skip: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
}

export function useVideoPlayer({
  onTimeUpdate,
  onEnded,
}: UseVideoPlayerOptions = {}): UseVideoPlayerReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    playbackRate: storedPlaybackRate,
    volume: storedVolume,
    setPlaybackRate: setStoredPlaybackRate,
    setVolume: setStoredVolume,
    currentVideo,
    updateVideoProgress,
  } = useVideoStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(storedVolume);

  // Sync with stored settings
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = storedVolume;
      videoRef.current.playbackRate = storedPlaybackRate;
    }
  }, [storedVolume, storedPlaybackRate]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);

      // Update progress in store
      if (currentVideo && duration > 0) {
        updateVideoProgress(currentVideo, time / duration);
      }
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onEnded, currentVideo, duration, updateVideoProgress]);

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const play = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  }, [duration]);

  const skip = useCallback(
    (seconds: number) => {
      seek(currentTime + seconds);
    },
    [currentTime, seek]
  );

  const setVolume = useCallback(
    (volume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      if (videoRef.current) {
        videoRef.current.volume = clampedVolume;
      }
      setStoredVolume(clampedVolume);
      if (clampedVolume > 0) {
        setPreviousVolume(clampedVolume);
      }
    },
    [setStoredVolume]
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      const clampedRate = Math.max(0.25, Math.min(4, rate));
      if (videoRef.current) {
        videoRef.current.playbackRate = clampedRate;
      }
      setStoredPlaybackRate(clampedRate);
    },
    [setStoredPlaybackRate]
  );

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current || videoRef.current?.parentElement;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (storedVolume > 0) {
      setVolume(0);
    } else {
      setVolume(previousVolume || 1);
    }
  }, [storedVolume, previousVolume, setVolume]);

  return {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    volume: storedVolume,
    playbackRate: storedPlaybackRate,
    isFullscreen,
    play,
    pause,
    togglePlay,
    seek,
    skip,
    setVolume,
    setPlaybackRate,
    toggleFullscreen,
    toggleMute,
  };
}
