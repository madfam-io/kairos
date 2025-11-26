/**
 * Client for the Kairos NLP service (PaddleNLP + CC-CEDICT)
 */

interface NLPConfig {
  baseUrl: string;
  timeout?: number;
}

interface WordSegment {
  text: string;
  pinyin: string | null;
  tone_marks: string | null;
  definitions: string[];
  hsk_level: number | null;
  pos: string | null;
  is_punctuation: boolean;
}

interface SegmentResponse {
  segments: WordSegment[];
  original_text: string;
  word_count: number;
}

interface LookupResponse {
  word: string;
  traditional: string | null;
  pinyin: string | null;
  definitions: string[];
  hsk_level: number | null;
  found: boolean;
}

interface HSKResponse {
  word: string;
  hsk_level: number | null;
  found: boolean;
}

interface HealthResponse {
  status: string;
  version: string;
  models_loaded: boolean;
  dictionary_entries: number;
}

export class NLPClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: NLPConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Segment Chinese text into words with analysis
   */
  async segment(
    text: string,
    options: {
      includePinyin?: boolean;
      includeDefinitions?: boolean;
      includeHsk?: boolean;
    } = {}
  ): Promise<SegmentResponse> {
    const response = await this.fetch('/segment', {
      method: 'POST',
      body: JSON.stringify({
        text,
        include_pinyin: options.includePinyin ?? true,
        include_definitions: options.includeDefinitions ?? true,
        include_hsk: options.includeHsk ?? true,
      }),
    });

    return response;
  }

  /**
   * Look up a word in the dictionary
   */
  async lookup(word: string): Promise<LookupResponse> {
    const response = await this.fetch('/lookup', {
      method: 'POST',
      body: JSON.stringify({ word }),
    });

    return response;
  }

  /**
   * Get HSK level for a word
   */
  async getHSKLevel(word: string): Promise<HSKResponse> {
    const response = await this.fetch(`/hsk/${encodeURIComponent(word)}`, {
      method: 'GET',
    });

    return response;
  }

  /**
   * Check service health
   */
  async health(): Promise<HealthResponse> {
    return this.fetch('/health', { method: 'GET' });
  }

  private async fetch(path: string, options: RequestInit): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`NLP service error: ${response.status} - ${error}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Global client instance
let nlpClient: NLPClient | null = null;

export function getNLPClient(): NLPClient {
  if (!nlpClient) {
    const baseUrl = process.env.NLP_SERVICE_URL ?? 'http://localhost:8000';
    nlpClient = new NLPClient({ baseUrl });
  }
  return nlpClient;
}

export function createNLPClient(config: NLPConfig): NLPClient {
  return new NLPClient(config);
}
