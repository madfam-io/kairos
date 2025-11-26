import type { PlasmoMessaging } from '@plasmohq/messaging';
import { Storage } from '@plasmohq/storage';
import type { CardCreateInput } from '@kairos/types';

const storage = new Storage();
const API_URL = process.env.PLASMO_PUBLIC_API_URL || 'https://api.kairos.dev';

interface RequestBody {
  word: string;
  sentence?: string;
  simplifiedSentence?: string;
  sourceTitle?: string;
  sourceTimestamp?: string;
}

interface ResponseBody {
  success: boolean;
  data?: {
    cardId: string;
    word: string;
  };
  error?: string;
}

const handler: PlasmoMessaging.MessageHandler<RequestBody, ResponseBody> = async (
  req,
  res
) => {
  const { word, sentence, simplifiedSentence, sourceTitle, sourceTimestamp } = req.body;

  if (!word) {
    return res.send({
      success: false,
      error: 'No word provided',
    });
  }

  try {
    const accessToken = await storage.get<string>('accessToken');

    if (!accessToken) {
      // Store locally if not logged in
      const localCards = (await storage.get<CardCreateInput[]>('localCards')) || [];
      const newCard: CardCreateInput = {
        word,
        sentence: sentence || '',
        simplifiedSentence,
        sourceTitle,
        sourceTimestamp,
      };
      localCards.push(newCard);
      await storage.set('localCards', localCards);

      // Update stats
      const stats = (await storage.get<{ cardsMined: number }>('stats')) || { cardsMined: 0 };
      stats.cardsMined++;
      await storage.set('stats', stats);

      return res.send({
        success: true,
        data: {
          cardId: `local-${Date.now()}`,
          word,
        },
      });
    }

    // Call API to create card
    const response = await fetch(`${API_URL}/api/v1/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        word,
        sentence: sentence || '',
        simplifiedSentence,
        sourceTitle,
        sourceTimestamp,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.send({
        success: false,
        error: error.error?.message || 'Failed to create card',
      });
    }

    const data = await response.json();

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icon-48.png'),
      title: 'Card Mined!',
      message: `Added "${word}" to your deck`,
    });

    return res.send({
      success: true,
      data: {
        cardId: data.data.id,
        word,
      },
    });
  } catch (error) {
    console.error('Mine word error:', error);
    return res.send({
      success: false,
      error: 'Failed to mine word',
    });
  }
};

export default handler;
