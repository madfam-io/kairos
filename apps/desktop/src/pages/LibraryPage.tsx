import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import {
  FolderOpen,
  Search,
  Grid,
  List,
  Play,
  MoreVertical,
  Trash2,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';

import { useVideoStore } from '~/store/video';

export function LibraryPage() {
  const navigate = useNavigate();
  const { recentVideos, setCurrentVideo, removeRecentVideo } = useVideoStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Video',
          extensions: ['mp4', 'mkv', 'avi', 'webm', 'mov'],
        },
      ],
    });

    if (selected) {
      setCurrentVideo(selected as string);
      navigate('/player');
    }
  };

  const filteredVideos = recentVideos.filter((video) =>
    video.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Library</h1>
        <button
          onClick={handleOpenFile}
          className="flex items-center gap-2 px-4 py-2 bg-kairos-600 hover:bg-kairos-500 rounded-lg transition-colors"
        >
          <FolderOpen size={18} />
          Open Video
        </button>
      </div>

      {/* Search and view toggle */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-kairos-600"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx(
              'p-2 rounded transition-colors',
              viewMode === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            )}
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'p-2 rounded transition-colors',
              viewMode === 'list' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            )}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Video list */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={32} className="text-gray-600" />
          </div>
          <h3 className="text-lg font-medium mb-2">No videos yet</h3>
          <p className="text-gray-400 mb-4">Open a video file to start learning</p>
          <button
            onClick={handleOpenFile}
            className="px-4 py-2 bg-kairos-600 hover:bg-kairos-500 rounded-lg transition-colors"
          >
            Open Video
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <VideoGridCard
              key={video.path}
              video={video}
              onPlay={() => {
                setCurrentVideo(video.path);
                navigate('/player');
              }}
              onDelete={() => removeRecentVideo(video.path)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredVideos.map((video) => (
            <VideoListItem
              key={video.path}
              video={video}
              onPlay={() => {
                setCurrentVideo(video.path);
                navigate('/player');
              }}
              onDelete={() => removeRecentVideo(video.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface VideoCardProps {
  video: {
    path: string;
    name: string;
    lastPlayed: Date;
    progress: number;
  };
  onPlay: () => void;
  onDelete: () => void;
}

function VideoGridCard({ video, onPlay, onDelete }: VideoCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="card group relative">
      {/* Thumbnail */}
      <button
        onClick={onPlay}
        className="aspect-video bg-gray-800 rounded-lg mb-3 flex items-center justify-center w-full group-hover:bg-gray-700 transition-colors"
      >
        <Play size={32} className="text-gray-600 group-hover:text-kairos-500 transition-colors" />
      </button>

      {/* Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{video.name}</h3>
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
            <Clock size={12} />
            {formatDate(video.lastPlayed)}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical size={16} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg shadow-lg py-1 z-10">
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 w-full text-red-400"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-full mt-3 overflow-hidden">
        <div
          className="h-full bg-kairos-600 rounded-full"
          style={{ width: `${video.progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function VideoListItem({ video, onPlay, onDelete }: VideoCardProps) {
  return (
    <div className="card flex items-center gap-4 group">
      {/* Thumbnail */}
      <button
        onClick={onPlay}
        className="w-32 aspect-video bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gray-700 transition-colors"
      >
        <Play size={24} className="text-gray-600 group-hover:text-kairos-500 transition-colors" />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{video.name}</h3>
        <p className="text-sm text-gray-500 mt-1">{formatDate(video.lastPlayed)}</p>
        {/* Progress bar */}
        <div className="h-1 bg-gray-800 rounded-full mt-2 overflow-hidden max-w-xs">
          <div
            className="h-full bg-kairos-600 rounded-full"
            style={{ width: `${video.progress * 100}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlay}
          className="px-4 py-2 bg-kairos-600 hover:bg-kairos-500 rounded-lg transition-colors"
        >
          Play
        </button>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-red-400"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
