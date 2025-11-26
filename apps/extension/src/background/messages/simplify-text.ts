import type { PlasmoMessaging } from '@plasmohq/messaging';
import { Storage } from '@plasmohq/storage';

const storage = new Storage();

// API base URL
const API_URL = process.env.PLASMO_PUBLIC_API_URL || 'http://localhost:3000';

interface RequestBody {
  text: string;
  targetLevel: number;
  context?: string;
}

interface ResponseBody {
  success: boolean;
  data?: {
    originalText: string;
    simplifiedText: string;
    targetLevel: number;
    confidence: number;
  };
  error?: string;
}

const handler: PlasmoMessaging.MessageHandler<RequestBody, ResponseBody> = async (
  req,
  res
) => {
  const { text, targetLevel, context } = req.body;

  if (!text) {
    return res.send({
      success: false,
      error: 'No text provided',
    });
  }

  try {
    // Get auth token if available
    const accessToken = await storage.get<string>('accessToken');

    // Check subscription tier - simplification requires paid tier
    const subscriptionTier = await storage.get<string>('subscriptionTier');
    if (subscriptionTier === 'free') {
      return res.send({
        success: false,
        error: 'Simplification requires a paid subscription',
      });
    }

    // Call API for simplification
    const response = await fetch(`${API_URL}/api/v1/nlp/simplify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({
        text,
        targetLevel,
        context,
        preserveNames: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.send({
        success: false,
        error: errorData.message || `API error: ${response.status}`,
      });
    }

    const data = await response.json();

    return res.send({
      success: true,
      data: {
        originalText: text,
        simplifiedText: data.data?.simplified || data.simplified || text,
        targetLevel,
        confidence: data.data?.confidence || 0.9,
      },
    });
  } catch (error) {
    console.error('Simplification error:', error);
    return res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Simplification failed',
    });
  }
};

export default handler;
