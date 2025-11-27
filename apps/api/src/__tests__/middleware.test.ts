import { describe, it, expect } from 'bun:test';
import {
  sanitizeBody,
  validators,
  safeJsonParse,
} from '../middleware/sanitize';

describe('Sanitization Middleware', () => {
  describe('sanitizeBody', () => {
    it('should escape HTML entities', () => {
      const input = {
        name: '<script>alert("xss")</script>',
        description: 'Normal text',
      };

      const result = sanitizeBody(input);

      expect(result.name).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
      expect(result.description).toBe('Normal text');
    });

    it('should trim whitespace', () => {
      const input = {
        name: '  hello world  ',
        email: '\n\ttest@example.com\n',
      };

      const result = sanitizeBody(input);

      expect(result.name).toBe('hello world');
      expect(result.email).toBe('test@example.com');
    });

    it('should remove null bytes', () => {
      const input = {
        data: 'hello\x00world',
      };

      const result = sanitizeBody(input);

      expect(result.data).toBe('helloworld');
    });

    it('should skip specified fields', () => {
      const input = {
        password: '<script>test</script>',
        username: '<script>test</script>',
      };

      const result = sanitizeBody(input);

      // password is in default skip list
      expect(result.password).toBe('<script>test</script>');
      // username is not skipped
      expect(result.username).toContain('&lt;script&gt;');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<b>John</b>',
          profile: {
            bio: '<script>bad</script>',
          },
        },
      };

      const result = sanitizeBody(input) as any;

      expect(result.user.name).toBe('&lt;b&gt;John&lt;&#x2F;b&gt;');
      expect(result.user.profile.bio).toContain('&lt;script&gt;');
    });

    it('should handle arrays', () => {
      const input = {
        tags: ['<b>tag1</b>', 'tag2', '<script>bad</script>'],
      };

      const result = sanitizeBody(input) as any;

      expect(result.tags[0]).toContain('&lt;b&gt;');
      expect(result.tags[1]).toBe('tag2');
      expect(result.tags[2]).toContain('&lt;script&gt;');
    });

    it('should prevent prototype pollution in nested objects', () => {
      const input = {
        user: {
          __proto__: { admin: true },
          constructor: { isAdmin: true },
          prototype: { isRoot: true },
          name: 'John',
        },
        normal: 'value',
      };

      const result = sanitizeBody(input) as any;

      // Nested dangerous keys should be stripped by sanitizeValue
      expect(Object.prototype.hasOwnProperty.call(result.user, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result.user, 'constructor')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result.user, 'prototype')).toBe(false);
      // Safe keys should be preserved
      expect(result.user.name).toBe('John');
      expect(result.normal).toBe('value');
      // Verify prototype wasn't actually polluted
      expect(({} as any).admin).toBeUndefined();
    });
  });

  describe('validators', () => {
    describe('isEmail', () => {
      it('should validate correct emails', () => {
        expect(validators.isEmail('test@example.com')).toBe(true);
        expect(validators.isEmail('user.name@domain.co.uk')).toBe(true);
        expect(validators.isEmail('user+tag@example.org')).toBe(true);
      });

      it('should reject invalid emails', () => {
        expect(validators.isEmail('notanemail')).toBe(false);
        expect(validators.isEmail('@example.com')).toBe(false);
        expect(validators.isEmail('user@')).toBe(false);
        expect(validators.isEmail('user @example.com')).toBe(false);
      });
    });

    describe('isUUID', () => {
      it('should validate correct UUIDs', () => {
        expect(validators.isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(
          true
        );
        expect(validators.isUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
          true
        );
      });

      it('should reject invalid UUIDs', () => {
        expect(validators.isUUID('not-a-uuid')).toBe(false);
        expect(validators.isUUID('550e8400-e29b-41d4-a716')).toBe(false);
        expect(validators.isUUID('')).toBe(false);
      });
    });

    describe('hasSqlInjection', () => {
      it('should detect SQL injection attempts', () => {
        // SQL keywords
        expect(validators.hasSqlInjection('SELECT * FROM users')).toBe(true);
        expect(validators.hasSqlInjection('UNION SELECT password')).toBe(true);
        expect(validators.hasSqlInjection('DROP TABLE users')).toBe(true);
        // SQL comments
        expect(validators.hasSqlInjection("'; DROP TABLE users;--")).toBe(true);
        expect(validators.hasSqlInjection('value/*comment*/')).toBe(true);
      });

      it('should not flag normal text', () => {
        expect(validators.hasSqlInjection('Hello world')).toBe(false);
        expect(validators.hasSqlInjection('My selection of books')).toBe(false);
        // Note: Simple OR patterns without SQL keywords are allowed
        // to avoid false positives on normal text
      });
    });

    describe('hasScriptInjection', () => {
      it('should detect script injection', () => {
        expect(
          validators.hasScriptInjection('<script>alert(1)</script>')
        ).toBe(true);
        expect(validators.hasScriptInjection('javascript:alert(1)')).toBe(true);
        expect(validators.hasScriptInjection('<img onerror=alert(1)>')).toBe(
          true
        );
      });

      it('should not flag normal text', () => {
        expect(validators.hasScriptInjection('Hello world')).toBe(false);
        expect(validators.hasScriptInjection('I love scripting')).toBe(false);
      });
    });

    describe('sanitizeFilename', () => {
      it('should remove path traversal', () => {
        expect(validators.sanitizeFilename('../../../etc/passwd')).toBe(
          'etcpasswd'
        );
        expect(validators.sanitizeFilename('..\\..\\windows\\system32')).toBe(
          'windowssystem32'
        );
      });

      it('should remove invalid characters', () => {
        expect(validators.sanitizeFilename('file<>:"|?.txt')).toBe('file.txt');
      });

      it('should limit length', () => {
        const longName = 'a'.repeat(300);
        expect(validators.sanitizeFilename(longName).length).toBe(255);
      });
    });

    describe('sanitizeUrl', () => {
      it('should allow http and https URLs', () => {
        expect(validators.sanitizeUrl('https://example.com')).toBe(
          'https://example.com/'
        );
        expect(validators.sanitizeUrl('http://localhost:3000/path')).toBe(
          'http://localhost:3000/path'
        );
      });

      it('should reject dangerous protocols', () => {
        expect(validators.sanitizeUrl('javascript:alert(1)')).toBeNull();
        expect(validators.sanitizeUrl('data:text/html,<script>')).toBeNull();
        expect(validators.sanitizeUrl('file:///etc/passwd')).toBeNull();
      });

      it('should reject invalid URLs', () => {
        expect(validators.sanitizeUrl('not a url')).toBeNull();
        expect(validators.sanitizeUrl('')).toBeNull();
      });
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null for invalid JSON', () => {
      expect(safeJsonParse('not json')).toBeNull();
      expect(safeJsonParse('{invalid}')).toBeNull();
    });

    it('should reject oversized JSON', () => {
      const large = JSON.stringify({ data: 'x'.repeat(1024 * 1024 + 1) });
      expect(safeJsonParse(large, { maxSize: 1024 * 1024 })).toBeNull();
    });

    it('should reject deeply nested JSON', () => {
      let nested: any = { value: 'deep' };
      for (let i = 0; i < 15; i++) {
        nested = { nested };
      }
      const json = JSON.stringify(nested);
      expect(safeJsonParse(json, { maxDepth: 10 })).toBeNull();
    });
  });
});
