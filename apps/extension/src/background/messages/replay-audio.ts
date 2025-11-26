import type { PlasmoMessaging } from '@plasmohq/messaging';

interface RequestBody {
  text?: string;
}

interface ResponseBody {
  success: boolean;
  error?: string;
}

const handler: PlasmoMessaging.MessageHandler<RequestBody, ResponseBody> = async (
  req,
  res
) => {
  const { text } = req.body || {};

  // Note: Audio replay is handled in the content script
  // This handler is for coordination between popup and content scripts

  try {
    // Send message to active tab to replay audio
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'REPLAY_AUDIO',
        text,
      });
    }

    return res.send({
      success: true,
    });
  } catch (error) {
    console.error('Replay audio error:', error);
    return res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to replay audio',
    });
  }
};

export default handler;
