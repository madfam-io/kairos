import type { PlasmoMessaging } from '@plasmohq/messaging';
import { Storage } from '@plasmohq/storage';
import type { SegmentationResult, Segment } from '@kairos/types';

const storage = new Storage();

// API base URL
const API_URL = process.env.PLASMO_PUBLIC_API_URL || 'https://api.kairos.dev';

interface RequestBody {
  text: string;
  knownWords?: string[];
}

interface ResponseBody {
  success: boolean;
  data?: SegmentationResult;
  error?: string;
}

const handler: PlasmoMessaging.MessageHandler<RequestBody, ResponseBody> = async (
  req,
  res
) => {
  const { text, knownWords } = req.body;

  if (!text) {
    return res.send({
      success: false,
      error: 'No text provided',
    });
  }

  try {
    // Get auth token if available
    const accessToken = await storage.get<string>('accessToken');

    // Call API for segmentation
    const response = await fetch(`${API_URL}/api/v1/nlp/segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({
        text,
        knownWords,
        detectAmbiguity: true,
      }),
    });

    if (!response.ok) {
      // Fallback to basic segmentation if API fails
      const basicSegments = basicSegmentation(text);
      return res.send({
        success: true,
        data: {
          segments: basicSegments,
          rawText: text,
          processingTimeMs: 0,
        },
      });
    }

    const data = await response.json();

    // Merge with known words from local storage
    const vocabulary = await storage.get<string[]>('knownWords') || [];
    const segments = (data.data?.segments || []).map((seg: Segment) => ({
      ...seg,
      isKnown: seg.isKnown || vocabulary.includes(seg.text),
    }));

    return res.send({
      success: true,
      data: {
        ...data.data,
        segments,
      },
    });
  } catch (error) {
    console.error('Segmentation error:', error);

    // Fallback to basic segmentation
    const basicSegments = basicSegmentation(text);
    return res.send({
      success: true,
      data: {
        segments: basicSegments,
        rawText: text,
        processingTimeMs: 0,
      },
    });
  }
};

/**
 * Basic character-level segmentation as fallback
 */
function basicSegmentation(text: string): Segment[] {
  const segments: Segment[] = [];
  let currentIndex = 0;

  const regex = /([\u4e00-\u9fff\u3400-\u4dbf]+|[^\u4e00-\u9fff\u3400-\u4dbf]+)/gu;
  const matches = text.matchAll(regex);

  for (const match of matches) {
    const matchText = match[0];
    const isChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(matchText);

    if (isChinese) {
      for (const char of matchText) {
        segments.push({
          text: char,
          pinyin: null,
          definition: null,
          hskLevel: null,
          isProperNoun: false,
          isKnown: false,
          startIndex: currentIndex,
          endIndex: currentIndex + char.length,
        });
        currentIndex += char.length;
      }
    } else {
      segments.push({
        text: matchText,
        pinyin: null,
        definition: null,
        hskLevel: null,
        isProperNoun: false,
        isKnown: true,
        startIndex: currentIndex,
        endIndex: currentIndex + matchText.length,
      });
      currentIndex += matchText.length;
    }
  }

  return segments;
}

export default handler;
