/**
 * Anki Export Service
 * Supports both AnkiConnect (local Anki) and CSV export
 */

import type { Card } from '@kairos/types';

// AnkiConnect default settings
const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
const ANKI_CONNECT_VERSION = 6;

interface AnkiConnectRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

interface AnkiConnectResponse {
  result: unknown;
  error: string | null;
}

interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  audio?: Array<{
    url: string;
    filename: string;
    fields: string[];
  }>;
}

/**
 * AnkiConnect client for local Anki integration
 */
export class AnkiConnectClient {
  private url: string;

  constructor(url: string = ANKI_CONNECT_URL) {
    this.url = url;
  }

  private async invoke<T>(action: string, params?: Record<string, unknown>): Promise<T> {
    const request: AnkiConnectRequest = {
      action,
      version: ANKI_CONNECT_VERSION,
      params,
    };

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`AnkiConnect request failed: ${response.status}`);
    }

    const data: AnkiConnectResponse = await response.json();

    if (data.error) {
      throw new Error(`AnkiConnect error: ${data.error}`);
    }

    return data.result as T;
  }

  /**
   * Check if AnkiConnect is available
   */
  async ping(): Promise<boolean> {
    try {
      await this.invoke('version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of deck names
   */
  async getDecks(): Promise<string[]> {
    return this.invoke<string[]>('deckNames');
  }

  /**
   * Create a new deck
   */
  async createDeck(deckName: string): Promise<number> {
    return this.invoke<number>('createDeck', { deck: deckName });
  }

  /**
   * Get list of model (note type) names
   */
  async getModels(): Promise<string[]> {
    return this.invoke<string[]>('modelNames');
  }

  /**
   * Create the Kairos note type if it doesn't exist
   */
  async ensureKairosModel(): Promise<void> {
    const models = await this.getModels();

    if (!models.includes('Kairos Chinese')) {
      await this.invoke('createModel', {
        modelName: 'Kairos Chinese',
        inOrderFields: [
          'Word',
          'Pinyin',
          'Definition',
          'Sentence',
          'SimplifiedSentence',
          'SentencePinyin',
          'HSKLevel',
          'Source',
          'Audio',
        ],
        css: `
          .card {
            font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
            font-size: 20px;
            text-align: center;
            color: #333;
            background-color: #f5f5f5;
            padding: 20px;
          }
          .word {
            font-size: 48px;
            color: #1a1a1a;
            margin-bottom: 10px;
          }
          .pinyin {
            font-size: 18px;
            color: #666;
            margin-bottom: 20px;
          }
          .definition {
            font-size: 16px;
            color: #444;
            margin-bottom: 20px;
          }
          .sentence {
            font-size: 18px;
            color: #333;
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
          }
          .simplified {
            font-size: 16px;
            color: #666;
            font-style: italic;
          }
          .meta {
            font-size: 12px;
            color: #999;
            margin-top: 20px;
          }
          .hsk {
            display: inline-block;
            background: #4f46e5;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
          }
        `,
        cardTemplates: [
          {
            Name: 'Recognition',
            Front: `
              <div class="word">{{Word}}</div>
              {{#Sentence}}<div class="sentence">{{Sentence}}</div>{{/Sentence}}
            `,
            Back: `
              {{FrontSide}}
              <hr id="answer">
              <div class="pinyin">{{Pinyin}}</div>
              <div class="definition">{{Definition}}</div>
              {{#SimplifiedSentence}}<div class="simplified">{{SimplifiedSentence}}</div>{{/SimplifiedSentence}}
              <div class="meta">
                {{#HSKLevel}}<span class="hsk">HSK {{HSKLevel}}</span>{{/HSKLevel}}
                {{#Source}} · {{Source}}{{/Source}}
              </div>
            `,
          },
          {
            Name: 'Production',
            Front: `
              <div class="definition">{{Definition}}</div>
              {{#Sentence}}<div class="sentence">{{SimplifiedSentence}}</div>{{/Sentence}}
            `,
            Back: `
              {{FrontSide}}
              <hr id="answer">
              <div class="word">{{Word}}</div>
              <div class="pinyin">{{Pinyin}}</div>
              {{#Sentence}}<div class="sentence">{{Sentence}}</div>{{/Sentence}}
            `,
          },
        ],
      });
    }
  }

  /**
   * Add a single note to Anki
   */
  async addNote(note: AnkiNote): Promise<number | null> {
    return this.invoke<number | null>('addNote', { note });
  }

  /**
   * Add multiple notes to Anki
   */
  async addNotes(notes: AnkiNote[]): Promise<(number | null)[]> {
    return this.invoke<(number | null)[]>('addNotes', { notes });
  }

  /**
   * Check which notes can be added (don't already exist)
   */
  async canAddNotes(notes: AnkiNote[]): Promise<boolean[]> {
    return this.invoke<boolean[]>('canAddNotes', { notes });
  }

  /**
   * Sync Anki (push changes to AnkiWeb)
   */
  async sync(): Promise<void> {
    await this.invoke('sync');
  }
}

/**
 * Convert Kairos cards to Anki notes
 */
export function cardsToAnkiNotes(cards: Card[], deckName: string = 'Kairos'): AnkiNote[] {
  return cards.map((card) => ({
    deckName,
    modelName: 'Kairos Chinese',
    fields: {
      Word: card.word,
      Pinyin: card.pinyin ?? '',
      Definition: card.definitions.join('; '),
      Sentence: card.sentence,
      SimplifiedSentence: card.simplifiedSentence ?? '',
      SentencePinyin: '', // TODO: Generate sentence pinyin
      HSKLevel: card.hskLevel?.toString() ?? '',
      Source: card.sourceTitle ?? '',
      Audio: '', // TODO: TTS audio
    },
    tags: [
      'kairos',
      ...(card.hskLevel ? [`hsk${card.hskLevel}`] : []),
      ...(card.sourceTitle ? [`source::${card.sourceTitle.replace(/\s+/g, '_')}`] : []),
    ],
  }));
}

/**
 * Convert Kairos cards to CSV format
 */
export function cardsToCSV(cards: Card[]): string {
  const headers = [
    'Word',
    'Pinyin',
    'Definition',
    'Sentence',
    'Simplified Sentence',
    'HSK Level',
    'Source',
    'Tags',
  ];

  const rows = cards.map((card) => [
    card.word,
    card.pinyin ?? '',
    card.definitions.join('; '),
    card.sentence,
    card.simplifiedSentence ?? '',
    card.hskLevel?.toString() ?? '',
    card.sourceTitle ?? '',
    ['kairos', card.hskLevel ? `hsk${card.hskLevel}` : ''].filter(Boolean).join(' '),
  ]);

  const escape = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvRows = [headers, ...rows].map((row) => row.map(escape).join(','));

  return csvRows.join('\n');
}

/**
 * Convert Kairos cards to Anki deck package format (.apkg)
 * This creates a text file that can be imported into Anki
 */
export function cardsToAnkiText(cards: Card[]): string {
  // Anki text import format: front\tback
  // Using tab-separated values for better compatibility
  const lines = cards.map((card) => {
    const front = `${card.word}${card.sentence ? `<br><br>${card.sentence}` : ''}`;
    const back = [
      card.pinyin ? `<div style="color:#666">${card.pinyin}</div>` : '',
      `<div>${card.definitions.join('<br>')}</div>`,
      card.simplifiedSentence ? `<div style="color:#888;font-style:italic">${card.simplifiedSentence}</div>` : '',
      card.hskLevel ? `<div style="color:#4f46e5;font-size:12px">HSK ${card.hskLevel}</div>` : '',
    ]
      .filter(Boolean)
      .join('');

    return `${front}\t${back}`;
  });

  return lines.join('\n');
}

// Global client instance
let ankiClient: AnkiConnectClient | null = null;

export function getAnkiClient(): AnkiConnectClient {
  if (!ankiClient) {
    ankiClient = new AnkiConnectClient();
  }
  return ankiClient;
}
