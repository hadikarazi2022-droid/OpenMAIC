/**
 * Rate Limiter with Queue Support
 * 
 * Implements a token bucket algorithm to limit API calls to a maximum rate
 * (default: 35 requests per minute) and queues excess requests for later execution.
 * 
 * Features:
 * - Configurable rate limit (requests per minute)
 * - Automatic queuing of requests exceeding the limit
 * - Priority queue support (optional)
 * - FIFO processing of queued requests
 * - Cancellation support for queued requests
 */

export interface RateLimiterOptions {
  /** Maximum requests per minute (default: 35) */
  rpm?: number;
  /** Optional identifier for this rate limiter instance */
  id?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface QueuedRequest<T> {
  /** Unique request ID */
  id: string;
  /** The function to execute when rate limit allows */
  execute: () => Promise<T>;
  /** Resolve callback with the result */
  resolve: (value: T | PromiseLike<T>) => void;
  /** Reject callback with error */
  reject: (reason?: any) => void;
  /** Timestamp when request was queued */
  queuedAt: number;
  /** Optional priority (higher = processed first, default: 0) */
  priority?: number;
  /** Whether this request has been cancelled */
  cancelled?: boolean;
}

export interface RateLimiterStats {
  /** Current queue length */
  queueLength: number;
  /** Total requests processed */
  totalProcessed: number;
  /** Total requests rejected/failed */
  totalRejected: number;
  /** Average wait time in ms */
  avgWaitTime: number;
  /** Timestamp of last request */
  lastRequestAt: number | null;
}

export class RateLimiter {
  private maxRpm: number;
  private tokens: number;
  private lastRefill: number;
  private queue: QueuedRequest<any>[];
  private processing: boolean;
  private debug: boolean;
  private id: string;
  
  // Stats tracking
  private totalProcessed: number = 0;
  private totalRejected: number = 0;
  private totalWaitTime: number = 0;
  private lastRequestAt: number | null = null;

  constructor(options: RateLimiterOptions = {}) {
    const { rpm = 35, id = 'default', debug = false } = options;
    
    if (rpm <= 0) {
      throw new Error('Rate limit (rpm) must be positive');
    }
    
    this.maxRpm = rpm;
    this.tokens = rpm; // Start with full bucket
    this.lastRefill = Date.now();
    this.queue = [];
    this.processing = false;
    this.debug = debug;
    this.id = id;
    
    this.log(`Initialized with ${rpm} RPM limit`);
  }

  /**
   * Execute a function with rate limiting
   * If rate limit is exceeded, the request will be queued
   */
  async execute<T>(fn: () => Promise<T>, priority?: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: this.generateId(),
        execute: fn,
        resolve,
        reject,
        queuedAt: Date.now(),
        priority: priority || 0,
        cancelled: false,
      };

      this.queue.push(request);
      // Sort by priority (higher first), then by queue time (FIFO)
      this.queue.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.queuedAt - b.queuedAt;
      });

      this.log(`Request ${request.id} queued (position: ${this.queue.length}, priority: ${request.priority})`);
      
      // Try to process immediately
      this.processQueue();
    });
  }

  /**
   * Process the queue, executing requests as tokens become available
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // Refill tokens based on elapsed time
        this.refillTokens();

        if (this.tokens < 1) {
          // No tokens available, wait for next refill
          const waitTime = this.getTimeUntilNextToken();
          this.log(`No tokens available, waiting ${waitTime}ms`);
          await this.sleep(waitTime);
          continue;
        }

        // Get next non-cancelled request
        const request = this.queue.shift();
        if (!request) continue;
        
        if (request.cancelled) {
          this.log(`Request ${request.id} was cancelled, skipping`);
          continue;
        }

        // Consume a token
        this.tokens--;
        this.lastRequestAt = Date.now();

        this.log(`Executing request ${request.id} (${this.tokens.toFixed(2)} tokens remaining)`);

        try {
          const result = await request.execute();
          this.totalProcessed++;
          const waitTime = Date.now() - request.queuedAt;
          this.totalWaitTime += waitTime;
          this.log(`Request ${request.id} completed successfully (waited ${waitTime}ms)`);
          request.resolve(result);
        } catch (error) {
          this.totalRejected++;
          this.log(`Request ${request.id} failed:`, error);
          request.reject(error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Refill tokens based on elapsed time
   * Tokens are added at a rate of maxRpm per minute
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 60000) * this.maxRpm; // Convert ms to minutes
    
    this.tokens = Math.min(this.maxRpm, this.tokens + tokensToAdd);
    this.lastRefill = now;
    
    this.log(`Refilled tokens: +${tokensToAdd.toFixed(2)}, total: ${this.tokens.toFixed(2)}`);
  }

  /**
   * Calculate time until next token is available
   */
  private getTimeUntilNextToken(): number {
    if (this.tokens >= 1) {
      return 0;
    }
    
    const tokensNeeded = 1 - this.tokens;
    const msPerToken = 60000 / this.maxRpm;
    return tokensNeeded * msPerToken;
  }

  /**
   * Cancel a queued request by ID
   * Returns true if the request was found and cancelled
   */
  cancel(requestId: string): boolean {
    const request = this.queue.find(r => r.id === requestId);
    if (request) {
      request.cancelled = true;
      this.log(`Cancelled request ${requestId}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all queued requests
   */
  clearQueue(reason?: string): void {
    const count = this.queue.length;
    this.queue.forEach(request => {
      if (reason) {
        request.reject(new Error(`Queue cleared: ${reason}`));
      } else {
        request.reject(new Error('Queue cleared'));
      }
    });
    this.queue = [];
    this.log(`Cleared ${count} requests from queue`);
  }

  /**
   * Get current statistics
   */
  getStats(): RateLimiterStats {
    const processed = this.totalProcessed || 1; // Avoid division by zero
    return {
      queueLength: this.queue.length,
      totalProcessed: this.totalProcessed,
      totalRejected: this.totalRejected,
      avgWaitTime: Math.round(this.totalWaitTime / processed),
      lastRequestAt: this.lastRequestAt,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalProcessed = 0;
    this.totalRejected = 0;
    this.totalWaitTime = 0;
    this.lastRequestAt = null;
    this.log('Stats reset');
  }

  /**
   * Generate a unique request ID
   */
  private generateId(): string {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log debug messages
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log(`[RateLimiter:${this.id}]`, ...args);
    }
  }
}

// Global rate limiter instance for API calls
let globalApiRateLimiter: RateLimiter | null = null;

/**
 * Get or create the global API rate limiter
 * @param rpm - Requests per minute limit (default: 35)
 * @param debug - Enable debug logging
 */
export function getApiRateLimiter(rpm: number = 35, debug: boolean = false): RateLimiter {
  if (!globalApiRateLimiter) {
    globalApiRateLimiter = new RateLimiter({ rpm, id: 'api', debug });
  }
  return globalApiRateLimiter;
}

/**
 * Reset the global API rate limiter (useful for testing)
 */
export function resetApiRateLimiter(): void {
  globalApiRateLimiter = null;
}
