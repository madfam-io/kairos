/**
 * NLP and AI-related type definitions
 */

import type { HSKLevel } from './user';

/**
 * Segmentation types
 */
export interface SegmentationResult {
  segments: Segment[];
  rawText: string;
  processingTimeMs: number;
}

export interface Segment {
  text: string;
  pinyin: string | null;
  definition: string | null;
  hskLevel: HSKLevel | null;
  isProperNoun: boolean;
  isKnown: boolean;
  startIndex: number;
  endIndex: number;
  alternatives?: SegmentAlternative[];
}

export interface SegmentAlternative {
  segments: Omit<Segment, 'alternatives'>[];
  confidence: number;
}

export interface SegmentationRequest {
  text: string;
  knownWords?: string[];
  detectAmbiguity?: boolean;
}

/**
 * Simplification types
 */
export interface SimplificationResult {
  originalText: string;
  simplifiedText: string;
  targetLevel: HSKLevel;
  confidence: number;
  cached: boolean;
  processingTimeMs: number;
}

export interface SimplificationRequest {
  text: string;
  targetLevel: HSKLevel;
  preserveProperNouns?: boolean;
  context?: string;
}

export interface BatchSimplificationRequest {
  sentences: Array<{
    text: string;
    index: number;
  }>;
  targetLevel: HSKLevel;
}

export interface BatchSimplificationResult {
  results: Array<{
    index: number;
    originalText: string;
    simplifiedText: string;
  }>;
  totalProcessingTimeMs: number;
}

/**
 * Grammar explanation types
 */
export interface GrammarExplanation {
  pattern: string;
  name: string;
  nameZh: string;
  explanation: string;
  structure: string;
  examples: GrammarExample[];
  relatedPatterns?: string[];
  hskLevel: HSKLevel | null;
}

export interface GrammarExample {
  chinese: string;
  pinyin: string;
  english: string;
  highlighted: string; // with pattern marked
}

export interface GrammarRequest {
  text: string;
  targetWord?: string;
}

/**
 * OCR types
 */
export interface OCRResult {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  processingTimeMs: number;
}

export interface OCRRequest {
  imageData: ArrayBuffer | Blob;
  region?: BoundingBox;
  language?: 'zh-Hans' | 'zh-Hant';
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Pitch detection types
 */
export interface PitchAnalysisResult {
  pitchContour: PitchPoint[];
  tones: ToneAnalysis[];
  overallScore: number;
  durationMs: number;
}

export interface PitchPoint {
  timeMs: number;
  frequency: number; // Hz
  confidence: number;
}

export interface ToneAnalysis {
  syllable: string;
  expectedTone: 1 | 2 | 3 | 4 | 5;
  detectedTone: 1 | 2 | 3 | 4 | 5 | null;
  score: number;
  feedback: string | null;
  startTimeMs: number;
  endTimeMs: number;
}

export interface PitchComparisonResult {
  reference: PitchAnalysisResult;
  user: PitchAnalysisResult;
  alignedComparison: Array<{
    timeMs: number;
    referenceHz: number;
    userHz: number;
    difference: number;
  }>;
  overallScore: number;
  feedback: string[];
}
