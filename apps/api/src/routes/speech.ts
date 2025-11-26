import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  transcribe,
  transcribeWithTimestamps,
  synthesize,
  synthesizeWithCloning,
  listSpeakers,
  checkSpeechHealth,
  type TTSSpeaker,
} from '../services/speech-client';

const speech = new Hono<AppEnv>();

// All speech routes require authentication
speech.use('/*', requireAuth());

// Health check
speech.get('/health', async (c) => {
  try {
    const health = await checkSpeechHealth();
    return c.json(health);
  } catch {
    return c.json({ status: 'error', message: 'Speech service unavailable' }, 503);
  }
});

// ============================================================================
// ASR (Speech-to-Text) Endpoints
// ============================================================================

// Transcribe audio to text
speech.post('/transcribe', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    const language = (formData.get('language') as string) || 'zh';

    if (!audioFile) {
      return c.json({ error: 'Audio file is required' }, 400);
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const result = await transcribe(audioBuffer, language as any);

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Transcription error:', error);
    return c.json({ error: 'Failed to transcribe audio' }, 500);
  }
});

// Transcribe with word-level timestamps
speech.post('/transcribe-timestamps', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    const language = (formData.get('language') as string) || 'zh';

    if (!audioFile) {
      return c.json({ error: 'Audio file is required' }, 400);
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const result = await transcribeWithTimestamps(audioBuffer, language as any);

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Transcription error:', error);
    return c.json({ error: 'Failed to transcribe audio' }, 500);
  }
});

// ============================================================================
// TTS (Text-to-Speech) Endpoints
// ============================================================================

// Synthesize speech from text
speech.post('/synthesize', async (c) => {
  try {
    const body = await c.req.json<{
      text: string;
      speaker?: TTSSpeaker;
      speed?: number;
    }>();

    if (!body.text) {
      return c.json({ error: 'Text is required' }, 400);
    }

    const audioBuffer = await synthesize(body.text, {
      speaker: body.speaker,
      speed: body.speed,
    });

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return c.json({ error: 'Failed to synthesize speech' }, 500);
  }
});

// Synthesize with voice cloning
speech.post('/clone', async (c) => {
  try {
    const formData = await c.req.formData();
    const text = formData.get('text') as string;
    const referenceFile = formData.get('reference_audio') as File;
    const referenceText = formData.get('reference_text') as string;

    if (!text || !referenceFile || !referenceText) {
      return c.json({
        error: 'Text, reference_audio, and reference_text are required',
      }, 400);
    }

    const referenceBuffer = await referenceFile.arrayBuffer();
    const audioBuffer = await synthesizeWithCloning(text, referenceBuffer, referenceText);

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Voice cloning error:', error);
    return c.json({ error: 'Failed to clone voice' }, 500);
  }
});

// List available TTS speakers
speech.get('/speakers', async (c) => {
  try {
    const speakers = await listSpeakers();
    return c.json({ speakers });
  } catch (error) {
    console.error('List speakers error:', error);
    return c.json({ error: 'Failed to list speakers' }, 500);
  }
});

export default speech;
