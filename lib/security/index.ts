
/**
 * Security Module for HaitianChatGpt
 * Input validation and sanitization
 */

export class InputValidator {
  static sanitizeString(input: string, maxLength: number = 10000): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .slice(0, maxLength)
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, '')
      .trim();
  }

  static sanitizeHTML(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static validateImageURL(url: string): boolean {
    if (!this.validateURL(url)) {
      return false;
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  }
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: { maxRequests: number; windowMs: number };

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.config = { maxRequests, windowMs };
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, [now]);
      return true;
    }

    const timestamps = this.requests.get(key)!;
    const recentRequests = timestamps.filter(t => t > windowStart);

    if (recentRequests.length < this.config.maxRequests) {
      recentRequests.push(now);
      this.requests.set(key, recentRequests);
      return true;
    }

    return false;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    if (!this.requests.has(key)) {
      return this.config.maxRequests;
    }

    const timestamps = this.requests.get(key)!;
    const recentRequests = timestamps.filter(t => t > windowStart);

    return Math.max(0, this.config.maxRequests - recentRequests.length);
  }

  getResetTime(key: string): number {
    if (!this.requests.has(key)) {
      return Date.now();
    }

    const timestamps = this.requests.get(key)!;
    if (timestamps.length === 0) {
      return Date.now();
    }

    return timestamps[0] + this.config.windowMs;
  }
}
