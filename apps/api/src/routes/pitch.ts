import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  extractPitch,
  analyzeTone,
  comparePitch,
  checkPitchHealth,
} from '../services/pitch-client';

const pitch = new Hono<AppEnv>();

// All pitch routes require authentication
pitch.use('/*', requireAuth());

// Health check
pitch.get('/health', async (c) => {
  try {
    const health = await checkPitchHealth();
    return c.json(health);
  } catch {
    return c.json({ status: 'error', message: 'Pitch service unavailable' }, 503);
  }
});

// Extract pitch contour from audio
pitch.post('/extract', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    const hopLength = formData.get('hop_length');
    const threshold = formData.get('threshold');

    if (!audioFile) {
      return c.json({ error: 'Audio file is required' }, 400);
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const result = await extractPitch(audioBuffer, {
      hopLength: hopLength ? parseInt(hopLength.toString(), 10) : undefined,
      threshold: threshold ? parseFloat(threshold.toString()) : undefined,
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Pitch extraction error:', error);
    return c.json({ error: 'Failed to extract pitch' }, 500);
  }
});

// Analyze Mandarin tone from audio
pitch.post('/analyze-tone', async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    const expectedTone = formData.get('expected_tone');

    if (!audioFile) {
      return c.json({ error: 'Audio file is required' }, 400);
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const result = await analyzeTone(
      audioBuffer,
      expectedTone ? parseInt(expectedTone.toString(), 10) : undefined
    );

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Tone analysis error:', error);
    return c.json({ error: 'Failed to analyze tone' }, 500);
  }
});

// Compare user pitch to reference
pitch.post('/compare', async (c) => {
  try {
    const formData = await c.req.formData();
    const referenceFile = formData.get('reference') as File;
    const userFile = formData.get('user_audio') as File;

    if (!referenceFile || !userFile) {
      return c.json({ error: 'Both reference and user audio files are required' }, 400);
    }

    const [referenceBuffer, userBuffer] = await Promise.all([
      referenceFile.arrayBuffer(),
      userFile.arrayBuffer(),
    ]);

    const result = await comparePitch(referenceBuffer, userBuffer);

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Pitch comparison error:', error);
    return c.json({ error: 'Failed to compare pitch' }, 500);
  }
});

export default pitch;
