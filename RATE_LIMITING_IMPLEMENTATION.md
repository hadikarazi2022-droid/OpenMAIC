# API Rate Limiting Implementation

## Overview
Implemented a comprehensive rate limiting system with automatic queuing for API calls, enforcing a maximum of **35 requests per minute (RPM)** by default.

## Files Created/Modified

### 1. New File: `/workspace/lib/utils/rate-limiter.ts`
A reusable rate limiter utility implementing the token bucket algorithm with queue support.

**Key Features:**
- **Token Bucket Algorithm**: Smoothly distributes API calls over time
- **Automatic Queuing**: Excess requests are automatically queued and processed when tokens become available
- **Priority Support**: Optional priority levels for queued requests (higher priority = processed first)
- **Cancellation**: Ability to cancel queued requests
- **Statistics Tracking**: Monitors queue length, processed/rejected counts, average wait times
- **Configurable Rate**: Default 35 RPM, can be overridden via `API_RATE_LIMIT_RPM` environment variable
- **Debug Logging**: Optional debug mode for monitoring rate limiter behavior

**Main Classes & Functions:**
- `RateLimiter` class: Core implementation
- `getApiRateLimiter(rpm?, debug?)`: Singleton accessor for global API rate limiter
- `resetApiRateLimiter()`: Reset function (useful for testing)

### 2. Modified: `/workspace/lib/media/image-providers.ts`
Wrapped the `generateImage()` function with rate limiting.

**Changes:**
```typescript
import { getApiRateLimiter } from '../utils/rate-limiter';

const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT_RPM || '35', 10);

export async function generateImage(...) {
  const rateLimiter = getApiRateLimiter(API_RATE_LIMIT);
  return rateLimiter.execute(async () => {
    // ... existing provider switch logic
  });
}
```

**Affected Providers:**
- Seedream
- OpenAI Image
- Qwen Image
- Nano Banana (Gemini)
- MiniMax Image
- Grok Image
- Lemonade

### 3. Modified: `/workspace/lib/media/video-providers.ts`
Wrapped the `generateVideo()` function with rate limiting.

**Changes:**
```typescript
import { getApiRateLimiter } from '../utils/rate-limiter';

const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT_RPM || '35', 10);

export async function generateVideo(...) {
  const rateLimiter = getApiRateLimiter(API_RATE_LIMIT);
  return rateLimiter.execute(async () => {
    // ... existing provider switch logic
  });
}
```

**Affected Providers:**
- Seedance
- Kling
- Veo
- Sora
- MiniMax Video
- Grok Video
- HappyHorse

### 4. Modified: `/workspace/lib/audio/tts-providers.ts`
Wrapped the `generateTTS()` function with rate limiting.

**Changes:**
```typescript
import { getApiRateLimiter } from '../utils/rate-limiter';

const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT_RPM || '35', 10);

export async function generateTTS(...) {
  const rateLimiter = getApiRateLimiter(API_RATE_LIMIT);
  return rateLimiter.execute(async () => {
    // ... existing provider switch logic
  });
}
```

**Affected Providers:**
- OpenAI TTS
- Azure TTS
- GLM TTS
- Qwen TTS
- VoxCPM TTS
- MiniMax TTS
- Doubao TTS
- ElevenLabs TTS
- Lemonade TTS

## Configuration

### Environment Variable
Set custom rate limit via environment variable:
```bash
API_RATE_LIMIT_RPM=50  # Override default 35 RPM
```

### Programmatic Configuration
```typescript
// Get rate limiter with custom settings
const limiter = getApiRateLimiter(50, true); // 50 RPM with debug logging

// Access statistics
const stats = limiter.getStats();
console.log(`Queue length: ${stats.queueLength}`);
console.log(`Average wait time: ${stats.avgWaitTime}ms`);

// Cancel a queued request
limiter.cancel(requestId);

// Clear entire queue
limiter.clearQueue('Maintenance');
```

## How It Works

### Token Bucket Algorithm
1. **Bucket Capacity**: Starts full with 35 tokens (for 35 RPM)
2. **Token Consumption**: Each API call consumes 1 token
3. **Token Refill**: Tokens refill continuously at 35/minute rate (~0.583 tokens/second)
4. **Queue When Empty**: If no tokens available, request is queued
5. **Process Queue**: As tokens refill, queued requests are processed in order

### Request Flow
```
Request → Check Tokens → [Available] → Execute Immediately
                    ↓
              [Not Available] → Queue Request
                    ↓
              Wait for Token → Execute from Queue
```

### Priority Queue
Requests can optionally specify priority (default: 0):
- Higher priority requests jump ahead in queue
- Same priority requests maintain FIFO order

## Usage Example

```typescript
// Normal usage - transparent to callers
const result = await generateImage(config, options);

// Under the hood:
// - If < 35 calls in last minute: executes immediately
// - If ≥ 35 calls: queued and executed when token available
// - Caller waits transparently until execution completes

// With priority (optional second parameter)
const result = await rateLimiter.execute(
  () => generateImage(config, options),
  10 // Higher priority
);
```

## Benefits

1. **Prevents API Rate Limit Errors**: Automatically throttles to stay within provider limits
2. **No Lost Requests**: All requests are queued and eventually processed
3. **Fair Scheduling**: FIFO ensures requests are processed in order received
4. **Priority Support**: Critical requests can be prioritized
5. **Observable**: Statistics allow monitoring of queue health
6. **Configurable**: Easy to adjust rate limits per deployment needs
7. **Reusable**: Generic implementation can be used for any API

## Testing Considerations

The rate limiter is designed to work seamlessly in production:
- No code changes required in calling code
- Transparent queuing with Promise-based API
- Error handling preserved (failed requests reject their promises)
- Statistics available for monitoring and debugging

## Future Enhancements

Potential improvements for future iterations:
- Per-provider rate limits (different providers have different limits)
- Distributed rate limiting (for multi-instance deployments)
- Retry logic for failed requests
- Backpressure signaling to upstream callers
- Persistent queue (survive server restarts)
