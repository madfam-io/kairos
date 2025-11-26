import type { PlasmoMessaging } from '@plasmohq/messaging';
import { Storage } from '@plasmohq/storage';

const storage = new Storage();

interface ResponseBody {
  success: boolean;
  enabled: boolean;
}

const handler: PlasmoMessaging.MessageHandler<void, ResponseBody> = async (
  _req,
  res
) => {
  try {
    // Get current settings
    const settings = await storage.get<Record<string, unknown>>('settings') || {};
    const currentEnabled = settings.simplificationEnabled ?? false;
    const newEnabled = !currentEnabled;

    // Update settings
    await storage.set('settings', {
      ...settings,
      simplificationEnabled: newEnabled,
    });

    return res.send({
      success: true,
      enabled: newEnabled,
    });
  } catch (error) {
    console.error('Toggle simplification error:', error);
    return res.send({
      success: false,
      enabled: false,
    });
  }
};

export default handler;
