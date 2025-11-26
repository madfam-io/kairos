import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Subtitle {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  segments?: Array<{
    text: string;
    pinyin: string | null;
    definition: string | null;
    hskLevel: number | null;
    isKnown: boolean;
  }>;
}

export interface RecentVideo {
  path: string;
  name: string;
  lastPlayed: Date;
  progress: number;
  duration?: number;
  subtitlePath?: string;
}

interface VideoState {
  currentVideo: string | null;
  subtitles: Subtitle[];
  currentSubtitleIndex: number;
  recentVideos: RecentVideo[];
  playbackRate: number;
  volume: number;

  setCurrentVideo: (path: string | null) => void;
  setSubtitles: (subtitles: Subtitle[]) => void;
  setCurrentSubtitleIndex: (index: number) => void;
  addRecentVideo: (video: RecentVideo) => void;
  updateVideoProgress: (path: string, progress: number) => void;
  removeRecentVideo: (path: string) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
}

export const useVideoStore = create<VideoState>()(
  persist(
    (set, get) => ({
      currentVideo: null,
      subtitles: [],
      currentSubtitleIndex: -1,
      recentVideos: [],
      playbackRate: 1,
      volume: 1,

      setCurrentVideo: (path) => {
        set({ currentVideo: path, subtitles: [], currentSubtitleIndex: -1 });
        if (path) {
          const name = path.split('/').pop() || path;
          const existing = get().recentVideos.find((v) => v.path === path);
          if (!existing) {
            get().addRecentVideo({
              path,
              name,
              lastPlayed: new Date(),
              progress: 0,
            });
          } else {
            set((state) => ({
              recentVideos: state.recentVideos.map((v) =>
                v.path === path ? { ...v, lastPlayed: new Date() } : v
              ),
            }));
          }
        }
      },

      setSubtitles: (subtitles) => set({ subtitles }),

      setCurrentSubtitleIndex: (index) => set({ currentSubtitleIndex: index }),

      addRecentVideo: (video) =>
        set((state) => ({
          recentVideos: [
            video,
            ...state.recentVideos.filter((v) => v.path !== video.path),
          ].slice(0, 50),
        })),

      updateVideoProgress: (path, progress) =>
        set((state) => ({
          recentVideos: state.recentVideos.map((v) =>
            v.path === path ? { ...v, progress } : v
          ),
        })),

      removeRecentVideo: (path) =>
        set((state) => ({
          recentVideos: state.recentVideos.filter((v) => v.path !== path),
        })),

      setPlaybackRate: (rate) => set({ playbackRate: rate }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: 'kairos-video-storage',
      partialize: (state) => ({
        recentVideos: state.recentVideos,
        playbackRate: state.playbackRate,
        volume: state.volume,
      }),
    }
  )
);
