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

// Japanese types
interface JapaneseWordSegment {
  text: string;
  reading: string | null;
  reading_katakana: string | null;
  dictionary_form: string;
  part_of_speech: string | null;
  definitions: string[];
  jlpt_level: number | null;
  is_punctuation: boolean;
}

interface JapaneseSegmentResponse {
  segments: JapaneseWordSegment[];
  original_text: string;
  word_count: number;
}

interface JapaneseLookupResponse {
  word: string;
  reading: string | null;
  reading_katakana: string | null;
  definitions: string[];
  jlpt_level: number | null;
  parts_of_speech: string[];
  found: boolean;
}

interface JLPTResponse {
  word: string;
  jlpt_level: number | null;
  jlpt_name: string | null;
  found: boolean;
}

// OCR types
interface OCRResponse {
  text: string;
  confidence: number;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
  language: string;
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

  // ============================================
  // Japanese Language Methods
  // ============================================

  /**
   * Segment Japanese text into words with analysis
   * Falls back to character-by-character if service unavailable
   */
  async segmentJapanese(
    text: string,
    options: {
      includeReading?: boolean;
      includeDefinitions?: boolean;
      includeJlpt?: boolean;
    } = {}
  ): Promise<JapaneseSegmentResponse> {
    try {
      const response = await this.fetch('/japanese/segment', {
        method: 'POST',
        body: JSON.stringify({
          text,
          include_reading: options.includeReading ?? true,
          include_definitions: options.includeDefinitions ?? true,
          include_jlpt: options.includeJlpt ?? true,
        }),
      });
      return response;
    } catch {
      // Fallback: character-by-character segmentation
      const JP_PUNCTUATION = /[\s。、！？「」『』【】（）・…ー〜―.,!?()[\]{}\"'\-:;/\\]/;
      const segments: JapaneseWordSegment[] = text.split('').map((char) => ({
        text: char,
        reading: null,
        reading_katakana: null,
        dictionary_form: char,
        part_of_speech: null,
        definitions: [],
        jlpt_level: null,
        is_punctuation: JP_PUNCTUATION.test(char),
      }));

      return {
        segments,
        original_text: text,
        word_count: segments.filter((s) => !s.is_punctuation).length,
      };
    }
  }

  /**
   * Look up a Japanese word in the dictionary
   */
  async lookupJapanese(word: string): Promise<JapaneseLookupResponse> {
    try {
      const response = await this.fetch('/japanese/lookup', {
        method: 'POST',
        body: JSON.stringify({ word }),
      });
      return response;
    } catch {
      return {
        word,
        reading: null,
        reading_katakana: null,
        definitions: [],
        jlpt_level: null,
        parts_of_speech: [],
        found: false,
      };
    }
  }

  /**
   * Get JLPT level for a Japanese word
   */
  async getJLPTLevel(word: string): Promise<JLPTResponse> {
    try {
      const response = await this.fetch(`/japanese/jlpt/${encodeURIComponent(word)}`, {
        method: 'GET',
      });
      return response;
    } catch {
      return {
        word,
        jlpt_level: null,
        jlpt_name: null,
        found: false,
      };
    }
  }

  // ============================================
  // OCR Methods
  // ============================================

  /**
   * Extract text from image using OCR
   */
  async ocr(
    imageData: string, // base64 or URL
    options: {
      language?: 'zh' | 'ja';
      region?: { x: number; y: number; width: number; height: number };
    } = {}
  ): Promise<OCRResponse> {
    try {
      const response = await this.fetch('/ocr', {
        method: 'POST',
        body: JSON.stringify({
          image: imageData,
          language: options.language ?? 'zh',
          region: options.region,
        }),
      });
      return response;
    } catch {
      // OCR service not available
      return {
        text: '',
        confidence: 0,
        bounding_box: options.region ?? null,
        language: options.language ?? 'zh',
      };
    }
  }

  /**
   * Check if Japanese NLP service is available
   */
  async isJapaneseAvailable(): Promise<boolean> {
    try {
      await this.fetch('/japanese/health', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if OCR service is available
   */
  async isOCRAvailable(): Promise<boolean> {
    try {
      await this.fetch('/ocr/health', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
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
