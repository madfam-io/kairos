import type { PlasmoMessaging } from '@plasmohq/messaging';
import { Storage } from '@plasmohq/storage';

const storage = new Storage();
const API_URL = process.env.PLASMO_PUBLIC_API_URL || 'https://api.kairos.dev';

interface RequestBody {
  word: string;
  sentence: string;
}

interface ResponseBody {
  success: boolean;
  data?: {
    word: string;
    pinyin: string | null;
    definitions: string[];
    hskLevel: number | null;
    examples: Array<{
      chinese: string;
      pinyin: string;
      english: string;
    }>;
  };
  error?: string;
}

const handler: PlasmoMessaging.MessageHandler<RequestBody, ResponseBody> = async (
  req,
  res
) => {
  const { word, sentence } = req.body;

  if (!word) {
    return res.send({
      success: false,
      error: 'No word provided',
    });
  }

  try {
    // Try to get dictionary entry from API
    const response = await fetch(
      `${API_URL}/api/v1/nlp/dictionary/${encodeURIComponent(word)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // Return basic info if dictionary lookup fails
      return res.send({
        success: true,
        data: {
          word,
          pinyin: null,
          definitions: [],
          hskLevel: null,
          examples: [],
        },
      });
    }

    const data = await response.json();

    // Track word lookup for analytics
    const accessToken = await storage.get<string>('accessToken');
    if (accessToken) {
      fetch(`${API_URL}/api/v1/analytics/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          eventType: 'word_lookup',
          eventData: { word, sentence },
        }),
      }).catch(() => {
        // Ignore analytics errors
      });
    }

    return res.send({
      success: true,
      data: data.data,
    });
  } catch (error) {
    console.error('Word lookup error:', error);
    return res.send({
      success: true,
      data: {
        word,
        pinyin: null,
        definitions: [],
        hskLevel: null,
        examples: [],
      },
    });
  }
};

export default handler;
