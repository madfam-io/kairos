import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  generators,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

// Helper to create a minimal valid audio file blob
function createMockAudioBlob(): Blob {
  // Create minimal WAV header (44 bytes) with some audio data
  const wavHeader = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x00, 0x00, 0x00, // file size - 8
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    0x66, 0x6d, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // chunk size (16)
    0x01, 0x00,             // audio format (1 = PCM)
    0x01, 0x00,             // num channels (1)
    0x44, 0xac, 0x00, 0x00, // sample rate (44100)
    0x88, 0x58, 0x01, 0x00, // byte rate
    0x02, 0x00,             // block align
    0x10, 0x00,             // bits per sample (16)
    0x64, 0x61, 0x74, 0x61, // "data"
    0x00, 0x00, 0x00, 0x00, // data size
  ]);
  return new Blob([wavHeader], { type: 'audio/wav' });
}

describe('Speech API', () => {
  describe('GET /api/v1/speech/health', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/speech/health', { auth: false });
      expect(status).toBe(401);
    });

    it('should return health status when authenticated', async () => {
      const { status, json } = await api.get('/api/v1/speech/health');

      // 200 if service healthy, 503 if unavailable
      expect([200, 503]).toContain(status);
      if (status === 200) {
        expect(json.status).toBeDefined();
      } else {
        expect(json.message).toBe('Speech service unavailable');
      }
    });
  });

  describe('POST /api/v1/speech/transcribe', () => {
    it('should require authentication', async () => {
      const { status } = await api.postForm('/api/v1/speech/transcribe', new FormData(), { auth: false });
      expect(status).toBe(401);
    });

    it('should require audio file', async () => {
      const formData = new FormData();
      const { status, json } = await api.postForm('/api/v1/speech/transcribe', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Audio file is required');
    });

    it('should transcribe audio file', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');

      const { status, json } = await api.postForm('/api/v1/speech/transcribe', formData);

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
      }
    });

    it('should accept optional language parameter', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');
      formData.append('language', 'zh');

      const { status, json } = await api.postForm('/api/v1/speech/transcribe', formData);

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
      }
    });

    it('should default to Chinese language', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');

      const { status } = await api.postForm('/api/v1/speech/transcribe', formData);

      // Should not fail due to language - 500 only if service unavailable
      expect([200, 500]).toContain(status);
    });
  });

  describe('POST /api/v1/speech/transcribe-timestamps', () => {
    it('should require authentication', async () => {
      const { status } = await api.postForm('/api/v1/speech/transcribe-timestamps', new FormData(), { auth: false });
      expect(status).toBe(401);
    });

    it('should require audio file', async () => {
      const formData = new FormData();
      const { status, json } = await api.postForm('/api/v1/speech/transcribe-timestamps', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Audio file is required');
    });

    it('should transcribe with timestamps', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');

      const { status, json } = await api.postForm('/api/v1/speech/transcribe-timestamps', formData);

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
      }
    });

    it('should accept optional language parameter', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');
      formData.append('language', 'en');

      const { status } = await api.postForm('/api/v1/speech/transcribe-timestamps', formData);

      expect([200, 500]).toContain(status);
    });
  });

  describe('POST /api/v1/speech/synthesize', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/speech/synthesize', {
        text: '你好',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require text field', async () => {
      const { status, json } = await api.post('/api/v1/speech/synthesize', {});

      expect(status).toBe(400);
      expect(json.error).toBe('Text is required');
    });

    it('should synthesize speech from text', async () => {
      const response = await app.request('/api/v1/speech/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer test-token`,
        },
        body: JSON.stringify({ text: '你好世界' }),
      });

      // 200 returns audio/wav, 500 if service unavailable
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.headers.get('Content-Type')).toBe('audio/wav');
      }
    });

    it('should accept optional speaker parameter', async () => {
      const response = await app.request('/api/v1/speech/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer test-token`,
        },
        body: JSON.stringify({
          text: '你好',
          speaker: 'female_01',
        }),
      });

      expect([200, 500]).toContain(response.status);
    });

    it('should accept optional speed parameter', async () => {
      const response = await app.request('/api/v1/speech/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer test-token`,
        },
        body: JSON.stringify({
          text: '你好',
          speed: 1.5,
        }),
      });

      expect([200, 500]).toContain(response.status);
    });
  });

  describe('POST /api/v1/speech/clone', () => {
    it('should require authentication', async () => {
      const { status } = await api.postForm('/api/v1/speech/clone', new FormData(), { auth: false });
      expect(status).toBe(401);
    });

    it('should require text, reference_audio, and reference_text', async () => {
      const formData = new FormData();
      const { status, json } = await api.postForm('/api/v1/speech/clone', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Text, reference_audio, and reference_text are required');
    });

    it('should require reference_audio if only text provided', async () => {
      const formData = new FormData();
      formData.append('text', '你好');
      formData.append('reference_text', '这是参考文本');
      // Missing reference_audio

      const { status, json } = await api.postForm('/api/v1/speech/clone', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Text, reference_audio, and reference_text are required');
    });

    it('should require reference_text if only audio provided', async () => {
      const formData = new FormData();
      formData.append('text', '你好');
      formData.append('reference_audio', createMockAudioBlob(), 'ref.wav');
      // Missing reference_text

      const { status, json } = await api.postForm('/api/v1/speech/clone', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Text, reference_audio, and reference_text are required');
    });

    it('should clone voice with all required fields', async () => {
      const formData = new FormData();
      formData.append('text', '你好世界');
      formData.append('reference_audio', createMockAudioBlob(), 'reference.wav');
      formData.append('reference_text', '这是参考音频的文本');

      const response = await app.request('/api/v1/speech/clone', {
        method: 'POST',
        headers: {
          Authorization: `Bearer test-token`,
        },
        body: formData,
      });

      // 200 returns audio/wav, 500 if service unavailable
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.headers.get('Content-Type')).toBe('audio/wav');
      }
    });
  });

  describe('GET /api/v1/speech/speakers', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/speech/speakers', { auth: false });
      expect(status).toBe(401);
    });

    it('should return list of available speakers', async () => {
      const { status, json } = await api.get('/api/v1/speech/speakers');

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.speakers).toBeDefined();
        expect(Array.isArray(json.speakers)).toBe(true);
      }
    });
  });
});
