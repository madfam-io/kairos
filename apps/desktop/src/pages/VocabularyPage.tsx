import { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  GraduationCap,
  Sparkles,
  Filter,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';

import { useVocabularyStore, type VocabularyWord } from '~/store/vocabulary';

type SortField = 'word' | 'status' | 'encounters' | 'lastSeen' | 'addedAt';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'new' | 'learning' | 'known';

export function VocabularyPage() {
  const { words, updateWordStatus, removeWord, getStats } = useVocabularyStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('addedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  const stats = getStats();

  const filteredWords = useMemo(() => {
    let result = [...words];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.word.includes(query) ||
          w.pinyin?.toLowerCase().includes(query) ||
          w.definitions.some((d) => d.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((w) => w.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'word':
          comparison = a.word.localeCompare(b.word);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'encounters':
          comparison = a.encounters - b.encounters;
          break;
        case 'lastSeen':
          comparison = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
          break;
        case 'addedAt':
          comparison = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [words, searchQuery, statusFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Vocabulary</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<BookOpen size={20} />}
          label="Total Words"
          value={stats.totalWords}
          color="blue"
        />
        <StatCard
          icon={<Sparkles size={20} />}
          label="New"
          value={stats.newWords}
          color="purple"
        />
        <StatCard
          icon={<GraduationCap size={20} />}
          label="Learning"
          value={stats.learningWords}
          color="yellow"
        />
        <StatCard
          icon={<GraduationCap size={20} />}
          label="Known"
          value={stats.knownWords}
          color="green"
        />
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search words, pinyin, or definitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-kairos-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:border-kairos-600"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="known">Known</option>
          </select>
        </div>
      </div>

      {/* Word list */}
      {filteredWords.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={32} className="text-gray-600" />
          </div>
          <h3 className="text-lg font-medium mb-2">No vocabulary yet</h3>
          <p className="text-gray-400">
            Start watching videos with Chinese subtitles to build your vocabulary
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b border-gray-800 text-sm font-medium text-gray-400">
            <SortHeader
              label="Word"
              field="word"
              currentField={sortField}
              order={sortOrder}
              onSort={toggleSort}
            />
            <SortHeader
              label="Status"
              field="status"
              currentField={sortField}
              order={sortOrder}
              onSort={toggleSort}
            />
            <SortHeader
              label="Encounters"
              field="encounters"
              currentField={sortField}
              order={sortOrder}
              onSort={toggleSort}
            />
            <SortHeader
              label="Last Seen"
              field="lastSeen"
              currentField={sortField}
              order={sortOrder}
              onSort={toggleSort}
            />
            <SortHeader
              label="Added"
              field="addedAt"
              currentField={sortField}
              order={sortOrder}
              onSort={toggleSort}
            />
            <span>Actions</span>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-gray-800">
            {filteredWords.map((word) => (
              <WordRow
                key={word.id}
                word={word}
                isExpanded={expandedWord === word.id}
                onToggle={() => setExpandedWord(expandedWord === word.id ? null : word.id)}
                onStatusChange={(status) => updateWordStatus(word.id, status)}
                onDelete={() => removeWord(word.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'purple' | 'yellow' | 'green';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    green: 'bg-green-500/10 text-green-400',
  };

  return (
    <div className="card">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center mb-3', colorClasses[color])}>
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  order: SortOrder;
  onSort: (field: SortField) => void;
}

function SortHeader({ label, field, currentField, order, onSort }: SortHeaderProps) {
  const isActive = field === currentField;

  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      {label}
      {isActive && (order === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
    </button>
  );
}

interface WordRowProps {
  word: VocabularyWord;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: VocabularyWord['status']) => void;
  onDelete: () => void;
}

function WordRow({ word, isExpanded, onToggle, onStatusChange, onDelete }: WordRowProps) {
  const statusColors = {
    new: 'bg-purple-500/20 text-purple-400',
    learning: 'bg-yellow-500/20 text-yellow-400',
    known: 'bg-green-500/20 text-green-400',
  };

  return (
    <div>
      <div
        className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center hover:bg-gray-800/50 cursor-pointer"
        onClick={onToggle}
      >
        <div>
          <span className="text-lg">{word.word}</span>
          {word.pinyin && (
            <span className="text-sm text-gray-400 ml-2">{word.pinyin}</span>
          )}
        </div>
        <div>
          <span className={clsx('px-2 py-1 rounded text-xs', statusColors[word.status])}>
            {word.status}
          </span>
        </div>
        <div className="text-gray-400">{word.encounters}</div>
        <div className="text-gray-400 text-sm">{formatDate(word.lastSeen)}</div>
        <div className="text-gray-400 text-sm">{formatDate(word.addedAt)}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Definitions</p>
              {word.definitions.length > 0 ? (
                <ul className="list-disc list-inside text-sm">
                  {word.definitions.map((def, i) => (
                    <li key={i}>{def}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No definitions available</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">HSK Level</p>
              <p className="text-sm">
                {word.hskLevel ? `HSK ${word.hskLevel}` : 'Unknown'}
              </p>
              {word.sentence && (
                <>
                  <p className="text-sm text-gray-400 mt-3 mb-1">Example Sentence</p>
                  <p className="text-sm">{word.sentence}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <p className="text-sm text-gray-400 mr-2">Change status:</p>
            {(['new', 'learning', 'known'] as const).map((status) => (
              <button
                key={status}
                onClick={() => onStatusChange(status)}
                className={clsx(
                  'px-3 py-1 rounded text-sm transition-colors',
                  word.status === status
                    ? 'bg-kairos-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600'
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d);
}
