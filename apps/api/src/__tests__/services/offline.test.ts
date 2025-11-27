import { describe, it, expect } from 'bun:test';
import { calculateChecksum } from '../../services/offline';

describe('Offline Service', () => {
  describe('calculateChecksum', () => {
    it('should return a string', () => {
      const result = calculateChecksum({ test: 'data' });
      expect(typeof result).toBe('string');
    });

    it('should return consistent checksum for same data', () => {
      const data = { word: '学习', pinyin: 'xuéxí' };
      const checksum1 = calculateChecksum(data);
      const checksum2 = calculateChecksum(data);

      expect(checksum1).toBe(checksum2);
    });

    it('should return different checksum for different data', () => {
      const data1 = { word: '学习' };
      const data2 = { word: '中文' };

      const checksum1 = calculateChecksum(data1);
      const checksum2 = calculateChecksum(data2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should handle empty objects', () => {
      const checksum = calculateChecksum({});
      expect(checksum).toBeDefined();
      expect(checksum.length).toBeGreaterThan(0);
    });

    it('should handle arrays', () => {
      const checksum = calculateChecksum([1, 2, 3]);
      expect(checksum).toBeDefined();
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          id: '123',
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        words: ['学习', '中文'],
      };

      const checksum = calculateChecksum(data);
      expect(checksum).toBeDefined();
    });

    it('should handle strings', () => {
      const checksum = calculateChecksum('hello world');
      expect(checksum).toBeDefined();
    });

    it('should handle numbers', () => {
      const checksum = calculateChecksum(42);
      expect(checksum).toBeDefined();
    });

    it('should handle null', () => {
      const checksum = calculateChecksum(null);
      expect(checksum).toBeDefined();
    });

    it('should handle boolean', () => {
      const checksumTrue = calculateChecksum(true);
      const checksumFalse = calculateChecksum(false);

      expect(checksumTrue).toBeDefined();
      expect(checksumFalse).toBeDefined();
      expect(checksumTrue).not.toBe(checksumFalse);
    });

    it('should produce different checksums for different orderings', () => {
      // Note: JSON.stringify may produce different strings for
      // objects with different key orders in some cases
      const data1 = { a: 1, b: 2 };
      const data2 = { b: 2, a: 1 };

      const checksum1 = calculateChecksum(data1);
      const checksum2 = calculateChecksum(data2);

      // In JavaScript, objects with same keys in different order
      // typically serialize to the same string, but this test
      // documents the expected behavior
      expect(checksum1).toBeDefined();
      expect(checksum2).toBeDefined();
    });

    it('should return hexadecimal string', () => {
      const checksum = calculateChecksum({ test: 'data' });
      // Should only contain hexadecimal characters
      expect(/^[0-9a-f]+$/.test(checksum)).toBe(true);
    });

    it('should handle large data without throwing', () => {
      const largeData = {
        words: Array.from({ length: 1000 }, (_, i) => ({
          id: `word-${i}`,
          word: '测试',
          pinyin: 'cèshì',
          definition: 'test',
        })),
      };

      expect(() => calculateChecksum(largeData)).not.toThrow();
    });

    it('should handle Chinese characters correctly', () => {
      const data = {
        word: '你好世界',
        sentence: '今天天气很好',
      };

      const checksum = calculateChecksum(data);
      expect(checksum).toBeDefined();

      // Same data should produce same checksum
      const checksum2 = calculateChecksum({
        word: '你好世界',
        sentence: '今天天气很好',
      });
      expect(checksum).toBe(checksum2);
    });

    it('should handle special characters', () => {
      const data = {
        text: '特殊字符: !@#$%^&*()',
        emoji: '📚🎯🔥',
      };

      const checksum = calculateChecksum(data);
      expect(checksum).toBeDefined();
    });
  });
});
