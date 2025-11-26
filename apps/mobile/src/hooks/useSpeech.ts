import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from './useAuth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
}

export type TTSSpeaker = '中文女' | '中文男' | '粤语女' | '英文女' | '英文男';

interface UseSpeechReturn {
  // Recording
  isRecording: boolean;
  recordingUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;

  // Playback
  isPlaying: boolean;
  playAudio: (uri: string) => Promise<void>;
  stopAudio: () => Promise<void>;

  // ASR
  transcribe: (audioUri: string) => Promise<TranscriptionResult>;

  // TTS
  synthesize: (text: string, speaker?: TTSSpeaker) => Promise<string>;

  // State
  loading: boolean;
  error: string | null;
}

export function useSpeech(): UseSpeechReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const authStore = useAuthStore();

  const getAuthHeaders = useCallback(() => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }
    return {
      Authorization: `Bearer ${authStore.session.accessToken}`,
    };
  }, [authStore.session?.accessToken]);

  // =========================================================================
  // Recording
  // =========================================================================

  const startRecording = useCallback(async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission denied');
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      throw err;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    try {
      if (!recordingRef.current) {
        throw new Error('No active recording');
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) {
        throw new Error('Recording URI not available');
      }

      setRecordingUri(uri);
      return uri;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(message);
      throw err;
    }
  }, []);

  // =========================================================================
  // Playback
  // =========================================================================

  const playAudio = useCallback(async (uri: string) => {
    try {
      // Stop any existing playback
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Load and play
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

      setIsPlaying(true);
      await sound.playAsync();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to play audio';
      setError(message);
      throw err;
    }
  }, []);

  const stopAudio = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop audio';
      setError(message);
    }
  }, []);

  // =========================================================================
  // ASR (Speech-to-Text)
  // =========================================================================

  const transcribe = useCallback(async (audioUri: string): Promise<TranscriptionResult> => {
    setLoading(true);
    setError(null);

    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert to blob
      const response = await fetch(audioUri);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');
      formData.append('language', 'zh');

      const res = await fetch(`${API_URL}/api/v1/speech/transcribe`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Transcription failed');
      }

      const result = await res.json();
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // =========================================================================
  // TTS (Text-to-Speech)
  // =========================================================================

  const synthesize = useCallback(async (
    text: string,
    speaker: TTSSpeaker = '中文女'
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/speech/synthesize`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, speaker }),
      });

      if (!response.ok) {
        throw new Error('Speech synthesis failed');
      }

      // Save audio to file
      const audioBlob = await response.blob();
      const audioUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;

      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            await FileSystem.writeAsStringAsync(audioUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            resolve(audioUri);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read audio'));
        reader.readAsDataURL(audioBlob);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Speech synthesis failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  return {
    isRecording,
    recordingUri,
    startRecording,
    stopRecording,
    isPlaying,
    playAudio,
    stopAudio,
    transcribe,
    synthesize,
    loading,
    error,
  };
}
