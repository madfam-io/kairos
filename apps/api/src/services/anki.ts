/**
 * Anki Export Service
 * Supports AnkiConnect (local Anki), CSV export, and .apkg generation
 */

import type { Card } from '@kairos/types';
import { getNLPClient } from './nlp-client';

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

export interface AnkiNote {
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

export interface EnrichedCard extends Card {
  pinyin?: string;
  definitions?: string[];
  hskLevel?: number;
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
        css: KAIROS_CARD_CSS,
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

// Card CSS for Anki
const KAIROS_CARD_CSS = `
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
`;

/**
 * Enrich cards with pinyin, definitions, and HSK level from NLP service
 */
export async function enrichCardsWithDictionary(cards: Card[]): Promise<EnrichedCard[]> {
  const nlpClient = getNLPClient();

  const enrichedCards = await Promise.all(
    cards.map(async (card) => {
      try {
        const lookup = await nlpClient.lookup(card.word);
        return {
          ...card,
          pinyin: lookup.pinyin || undefined,
          definitions: lookup.definitions || [],
          hskLevel: lookup.hsk_level || undefined,
        };
      } catch {
        // If lookup fails, return card without enrichment
        return {
          ...card,
          pinyin: undefined,
          definitions: [],
          hskLevel: undefined,
        };
      }
    })
  );

  return enrichedCards;
}

/**
 * Convert Kairos cards to Anki notes
 */
export function cardsToAnkiNotes(cards: Card[], deckName: string = 'Kairos'): AnkiNote[] {
  return cards.map((card) => {
    const enriched = card as EnrichedCard;
    return {
      deckName,
      modelName: 'Kairos Chinese',
      fields: {
        Word: card.word,
        Pinyin: enriched.pinyin ?? '',
        Definition: enriched.definitions?.join('; ') ?? '',
        Sentence: card.sentence ?? '',
        SimplifiedSentence: card.simplifiedSentence ?? '',
        SentencePinyin: '', // TODO: Generate sentence pinyin
        HSKLevel: enriched.hskLevel?.toString() ?? '',
        Source: card.sourceTitle ?? '',
        Audio: card.audioUrl ?? '',
      },
      tags: [
        'kairos',
        ...(enriched.hskLevel ? [`hsk${enriched.hskLevel}`] : []),
        ...(card.sourceTitle ? [`source::${card.sourceTitle.replace(/\s+/g, '_')}`] : []),
      ],
    };
  });
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

  const rows = cards.map((card) => {
    const enriched = card as EnrichedCard;
    return [
      card.word,
      enriched.pinyin ?? '',
      enriched.definitions?.join('; ') ?? '',
      card.sentence ?? '',
      card.simplifiedSentence ?? '',
      enriched.hskLevel?.toString() ?? '',
      card.sourceTitle ?? '',
      ['kairos', enriched.hskLevel ? `hsk${enriched.hskLevel}` : ''].filter(Boolean).join(' '),
    ];
  });

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
 * Convert Kairos cards to Anki text import format
 */
export function cardsToAnkiText(cards: Card[]): string {
  const lines = cards.map((card) => {
    const enriched = card as EnrichedCard;
    const front = `${card.word}${card.sentence ? `<br><br>${card.sentence}` : ''}`;
    const back = [
      enriched.pinyin ? `<div style="color:#666">${enriched.pinyin}</div>` : '',
      enriched.definitions?.length
        ? `<div>${enriched.definitions.join('<br>')}</div>`
        : '',
      card.simplifiedSentence
        ? `<div style="color:#888;font-style:italic">${card.simplifiedSentence}</div>`
        : '',
      enriched.hskLevel
        ? `<div style="color:#4f46e5;font-size:12px">HSK ${enriched.hskLevel}</div>`
        : '',
    ]
      .filter(Boolean)
      .join('');

    return `${front}\t${back}`;
  });

  return lines.join('\n');
}

/**
 * Generate an Anki package (.apkg) file
 * Uses SQLite to create the Anki database format
 */
export async function generateApkgFile(
  cards: Card[],
  deckName: string = 'Kairos Chinese'
): Promise<Buffer> {
  // Anki uses a SQLite database with a specific schema
  // For simplicity, we'll generate a text file that can be imported
  // A full .apkg would require proper SQLite database creation

  const enrichedCards = await enrichCardsWithDictionary(cards);

  // Generate the deck data structure
  const deckData = {
    name: deckName,
    cards: enrichedCards.map((card, index) => ({
      id: index + 1,
      word: card.word,
      pinyin: card.pinyin ?? '',
      definition: card.definitions?.join('; ') ?? '',
      sentence: card.sentence ?? '',
      simplifiedSentence: card.simplifiedSentence ?? '',
      hskLevel: card.hskLevel,
      source: card.sourceTitle ?? '',
      audio: card.audioUrl ?? '',
    })),
    model: {
      name: 'Kairos Chinese',
      css: KAIROS_CARD_CSS,
    },
    exportedAt: new Date().toISOString(),
  };

  // Return as JSON for now - can be expanded to full SQLite .apkg later
  return Buffer.from(JSON.stringify(deckData, null, 2));
}

/**
 * Generate Anki import file with headers for field mapping
 */
export function cardsToAnkiImport(cards: Card[]): string {
  // Header comment for Anki import
  const header = [
    '#separator:tab',
    '#html:true',
    '#deck:Kairos Chinese',
    '#notetype:Basic',
    '#columns:Front\tBack',
  ].join('\n');

  const enrichedText = cardsToAnkiText(cards);

  return `${header}\n${enrichedText}`;
}

// Global client instance
let ankiClient: AnkiConnectClient | null = null;

export function getAnkiClient(): AnkiConnectClient {
  if (!ankiClient) {
    ankiClient = new AnkiConnectClient();
  }
  return ankiClient;
}
