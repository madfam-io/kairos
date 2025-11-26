/**
 * Client for the Kairos AI Simplification service
 */

interface SimplifyConfig {
  baseUrl: string;
  timeout?: number;
}

interface SimplifyResult {
  original: string;
  simplified: string;
  targetLevel: number;
  confidence: number;
  cached: boolean;
  tokensUsed: number;
}

interface BatchSimplifyResult {
  results: SimplifyResult[];
  totalTokens: number;
  cacheHits: number;
}

export class SimplifyClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: SimplifyConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? 60000;
  }

  /**
   * Simplify a single Chinese sentence
   */
  async simplify(
    text: string,
    options: {
      targetLevel?: number;
      preserveNames?: boolean;
      context?: string;
    } = {}
  ): Promise<SimplifyResult> {
    const response = await this.fetch('/simplify', {
      method: 'POST',
      body: JSON.stringify({
        text,
        target_level: options.targetLevel ?? 3,
        preserve_names: options.preserveNames ?? true,
        context: options.context,
      }),
    });

    const data = response.data;
    return {
      original: data.original,
      simplified: data.simplified,
      targetLevel: data.target_level,
      confidence: data.confidence,
      cached: data.cached ?? false,
      tokensUsed: data.tokens_used ?? 0,
    };
  }

  /**
   * Simplify multiple sentences in batch
   */
  async simplifyBatch(
    sentences: string[],
    options: {
      targetLevel?: number;
      preserveNames?: boolean;
    } = {}
  ): Promise<BatchSimplifyResult> {
    const response = await this.fetch('/simplify/batch', {
      method: 'POST',
      body: JSON.stringify({
        sentences,
        target_level: options.targetLevel ?? 3,
        preserve_names: options.preserveNames ?? true,
      }),
    });

    const data = response.data;
    return {
      results: data.results.map((r: any) => ({
        original: r.original,
        simplified: r.simplified,
        targetLevel: r.target_level,
        confidence: r.confidence,
        cached: r.cached ?? false,
        tokensUsed: r.tokens_used ?? 0,
      })),
      totalTokens: data.total_tokens ?? 0,
      cacheHits: data.cache_hits ?? 0,
    };
  }

  /**
   * Check service health
   */
  async health(): Promise<{ status: string; modelLoaded: boolean; gpuAvailable: boolean }> {
    const response = await this.fetch('/health', { method: 'GET' });
    return {
      status: response.status,
      modelLoaded: response.model_loaded,
      gpuAvailable: response.gpu_available,
    };
  }

  private async fetch(path: string, options: RequestInit): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Simplify service error: ${response.status} - ${error}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Global client instance
let simplifyClient: SimplifyClient | null = null;

export function getSimplifyClient(): SimplifyClient {
  if (!simplifyClient) {
    const baseUrl = process.env.SIMPLIFY_SERVICE_URL ?? 'https://kairos-simplify--web-app.modal.run';
    simplifyClient = new SimplifyClient({ baseUrl });
  }
  return simplifyClient;
}
