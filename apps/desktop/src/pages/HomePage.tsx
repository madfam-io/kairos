import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Play,
  FolderOpen,
  Clock,
  TrendingUp,
  BookOpen,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useVideoStore } from '~/store/video';
import { useStatsStore } from '~/store/stats';

export function HomePage() {
  const navigate = useNavigate();
  const { recentVideos, setCurrentVideo } = useVideoStore();
  const { wordsLearnedToday, cardsMinedToday, currentStreak, totalWordsLearned } = useStatsStore();

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.mkv', '.avi', '.webm', '.mov'],
    },
    onDrop: (files) => {
      if (files.length > 0) {
        setCurrentVideo(files[0].path);
        navigate('/player');
      }
    },
    noClick: true,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Hero section */}
      <div
        className={`
          relative rounded-2xl border-2 border-dashed transition-colors mb-8
          ${isDragActive ? 'border-kairos-500 bg-kairos-500/10' : 'border-gray-700 hover:border-gray-600'}
        `}
      >
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-kairos-500 to-kairos-700 flex items-center justify-center mx-auto mb-4">
            <Play size={32} />
          </div>
          <h1 className="text-2xl font-semibold mb-2">
            {isDragActive ? 'Drop video here' : 'Start Learning'}
          </h1>
          <p className="text-gray-400 mb-6">
            Drag and drop a video file or click to browse
          </p>
          <button
            onClick={handleOpenFile}
            className="inline-flex items-center gap-2 px-6 py-3 bg-kairos-600 hover:bg-kairos-500 rounded-xl font-medium transition-colors"
          >
            <FolderOpen size={20} />
            Open Video File
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={BookOpen}
          label="Words Today"
          value={wordsLearnedToday}
          color="kairos"
        />
        <StatCard
          icon={Zap}
          label="Cards Mined"
          value={cardsMinedToday}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Day Streak"
          value={currentStreak}
          color="orange"
        />
        <StatCard
          icon={BookOpen}
          label="Total Words"
          value={totalWordsLearned}
          color="purple"
        />
      </div>

      {/* Recent videos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock size={20} className="text-gray-400" />
            Recent Videos
          </h2>
          <button className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
            View all <ChevronRight size={16} />
          </button>
        </div>

        {recentVideos.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400">No recent videos</p>
            <p className="text-sm text-gray-500 mt-1">
              Open a video to start learning
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {recentVideos.slice(0, 6).map((video) => (
              <VideoCard
                key={video.path}
                video={video}
                onClick={() => {
                  setCurrentVideo(video.path);
                  navigate('/player');
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: 'kairos' | 'blue' | 'orange' | 'purple';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    kairos: 'text-kairos-400 bg-kairos-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };

  return (
    <div className="card">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
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
  onClick: () => void;
}

function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <button
      onClick={onClick}
      className="card text-left hover:border-kairos-600 group"
    >
      {/* Thumbnail placeholder */}
      <div className="aspect-video bg-gray-800 rounded-lg mb-3 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
        <Play size={32} className="text-gray-600 group-hover:text-kairos-500 transition-colors" />
      </div>
      <h3 className="font-medium truncate">{video.name}</h3>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">
          {Math.round(video.progress * 100)}% complete
        </span>
        <span className="text-xs text-gray-500">
          {formatRelativeTime(video.lastPlayed)}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-kairos-600 rounded-full"
          style={{ width: `${video.progress * 100}%` }}
        />
      </div>
    </button>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}
