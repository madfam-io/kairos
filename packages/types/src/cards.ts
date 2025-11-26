/**
 * Mining cards type definitions
 */

export interface Card {
  id: string;
  userId: string;
  word: string;
  sentence: string;
  simplifiedSentence: string | null;
  audioUrl: string | null;
  screenshotUrl: string | null;
  sourceTitle: string | null;
  sourceTimestamp: string | null;
  exportedToAnki: boolean;
  createdAt: Date;
}

export interface CardCreateInput {
  word: string;
  sentence: string;
  simplifiedSentence?: string;
  audioBlob?: Blob;
  screenshotBlob?: Blob;
  sourceTitle?: string;
  sourceTimestamp?: string;
}

export interface CardQuery {
  exportedToAnki?: boolean;
  search?: string;
  sourceTitle?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'word';
  sortOrder?: 'asc' | 'desc';
}

export interface CardExportOptions {
  format: 'anki' | 'csv' | 'json';
  includeAudio: boolean;
  includeScreenshot: boolean;
  includeSimplified: boolean;
  cardIds?: string[];
}

export interface AnkiExportResult {
  deckName: string;
  cardCount: number;
  ankiPackageUrl?: string;
}

/**
 * Anki Note Type fields
 */
export interface KairosAnkiNote {
  word: string;
  pinyin: string;
  definition: string;
  sentence: string;
  simplifiedSentence: string;
  audio: string; // [sound:filename.mp3]
  screenshot: string; // <img src="filename.jpg">
  source: string;
}
