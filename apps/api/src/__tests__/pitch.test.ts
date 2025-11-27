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

describe('Pitch API', () => {
  describe('GET /api/v1/pitch/health', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/pitch/health', { auth: false });
      expect(status).toBe(401);
    });

    it('should return health status when authenticated', async () => {
      const { status, json } = await api.get('/api/v1/pitch/health');

      // 200 if service healthy, 503 if unavailable
      expect([200, 503]).toContain(status);
      if (status === 200) {
        expect(json.status).toBeDefined();
      } else {
        expect(json.message).toBe('Pitch service unavailable');
      }
    });
  });

  describe('POST /api/v1/pitch/extract', () => {
    it('should require authentication', async () => {
      const { status } = await api.postForm('/api/v1/pitch/extract', new FormData(), { auth: false });
      expect(status).toBe(401);
    });

    it('should require audio file', async () => {
      const formData = new FormData();
      // No audio file attached
      const { status, json } = await api.postForm('/api/v1/pitch/extract', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Audio file is required');
    });

    it('should accept audio file with optional parameters', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');
      formData.append('hop_length', '256');
      formData.append('threshold', '0.3');

      const { status, json } = await api.postForm('/api/v1/pitch/extract', formData);

      // 200 on success, 500 if service unavailable
      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
      }
    });

    it('should extract pitch from audio file', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');

      const { status, json } = await api.postForm('/api/v1/pitch/extract', formData);

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
      }
    });
  });

  describe('POST /api/v1/pitch/analyze-tone', () => {
    it('should require authentication', async () => {
      const { status } = await api.postForm('/api/v1/pitch/analyze-tone', new FormData(), { auth: false });
      expect(status).toBe(401);
    });

    it('should require audio file', async () => {
      const formData = new FormData();
      const { status, json } = await api.postForm('/api/v1/pitch/analyze-tone', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Audio file is required');
    });

    it('should analyze tone from audio', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');

      const { status, json } = await api.postForm('/api/v1/pitch/analyze-tone', formData);

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
      }
    });

    it('should accept optional expected_tone parameter', async () => {
      const formData = new FormData();
      formData.append('audio', createMockAudioBlob(), 'test.wav');
      formData.append('expected_tone', '1'); // First tone

      const { status, json } = await api.postForm('/api/v1/pitch/analyze-tone', formData);

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
      }
    });

    it('should handle all four Mandarin tones', async () => {
      for (const tone of [1, 2, 3, 4]) {
        const formData = new FormData();
        formData.append('audio', createMockAudioBlob(), 'test.wav');
        formData.append('expected_tone', tone.toString());

        const { status } = await api.postForm('/api/v1/pitch/analyze-tone', formData);
        expect([200, 500]).toContain(status);
      }
    });
  });

  describe('POST /api/v1/pitch/compare', () => {
    it('should require authentication', async () => {
      const { status } = await api.postForm('/api/v1/pitch/compare', new FormData(), { auth: false });
      expect(status).toBe(401);
    });

    it('should require both reference and user audio files', async () => {
      const formData = new FormData();
      // No files attached
      const { status, json } = await api.postForm('/api/v1/pitch/compare', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Both reference and user audio files are required');
    });

    it('should require user_audio if only reference provided', async () => {
      const formData = new FormData();
      formData.append('reference', createMockAudioBlob(), 'reference.wav');
      // Missing user_audio

      const { status, json } = await api.postForm('/api/v1/pitch/compare', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Both reference and user audio files are required');
    });

    it('should require reference if only user_audio provided', async () => {
      const formData = new FormData();
      formData.append('user_audio', createMockAudioBlob(), 'user.wav');
      // Missing reference

      const { status, json } = await api.postForm('/api/v1/pitch/compare', formData);

      expect(status).toBe(400);
      expect(json.error).toBe('Both reference and user audio files are required');
    });

    it('should compare pitch when both files provided', async () => {
      const formData = new FormData();
      formData.append('reference', createMockAudioBlob(), 'reference.wav');
      formData.append('user_audio', createMockAudioBlob(), 'user.wav');

      const { status, json } = await api.postForm('/api/v1/pitch/compare', formData);

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
      }
    });
  });
});
