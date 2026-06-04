/**
 * Comprehensive Security and Input Validation System
 * Protects against common vulnerabilities and ensures secure data handling
 */

import crypto from 'crypto';

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

/**
 * Encrypt sensitive data at rest
 */
export class DataEncryption {
  private algorithm = 'aes-256-cbc';
  private encryptionKey: Buffer;

  constructor(encryptionKey?: string) {
    if (!encryptionKey) {
      throw new Error('Encryption key is required');
    }
    // Ensure key is exactly 32 bytes for aes-256
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(encryptionKey)
      .digest();
  }

  /**
   * Encrypt a string
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return iv:encrypted for storage
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a string
   */
  decrypt(encryptedData: string): string {
    const [ivHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash a string (one-way, for passwords)
   */
  static hash(plaintext: string, salt?: string): string {
    const saltValue = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(plaintext, saltValue, 100000, 64, 'sha512')
      .toString('hex');
    return saltValue + ':' + hash;
  }

  /**
   * Verify a hashed string
   */
  static verify(plaintext: string, hashedValue: string): boolean {
    const [salt, hash] = hashedValue.split(':');
    const newHash = crypto
      .pbkdf2Sync(plaintext, salt, 100000, 64, 'sha512')
      .toString('hex');
    return hash === newHash;
  }
}

// ============================================================================
// INPUT VALIDATION AND SANITIZATION
// ============================================================================

export class InputValidator {
  /**
   * Sanitize string input to prevent XSS attacks
   */
  static sanitizeString(input: string, maxLength: number = 10000): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .slice(0, maxLength)
      // Remove script tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove data: protocol (can be used for XSS)
      .replace(/data:text\/html/gi, '')
      .trim();
  }

  /**
   * Sanitize HTML input
   */
  static sanitizeHTML(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate email address
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate URL
   */
  static validateURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Validate image URL
   */
  static validateImageURL(url: string): boolean {
    if (!this.validateURL(url)) {
      return false;
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  }

  /**
   * Validate file upload
   */
  static validateFileUpload(
    file: { name: string; size: number; type: string },
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxSizeBytes: number = 10 * 1024 * 1024 // 10MB
  ): { valid: boolean; error?: string } {
    if (!file.name || file.name.length === 0) {
      return { valid: false, error: 'File name is required' };
    }

    if (file.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size exceeds ${maxSizeBytes / 1024 / 1024}MB limit` };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: `File type ${file.type} is not allowed` };
    }

    // Check for suspicious file names
    if (/[<>:"|?*]/.test(file.name)) {
      return { valid: false, error: 'File name contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Validate JSON input
   */
  static validateJSON(input: string): { valid: boolean; data?: any; error?: string } {
    try {
      const data = JSON.parse(input);
      return { valid: true, data };
    } catch (error) {
      return { valid: false, error: 'Invalid JSON format' };
    }
  }

  /**
   * Validate API key format
   */
  static validateAPIKey(apiKey: string): boolean {
    // Basic validation: should be alphanumeric and at least 32 characters
    return /^[a-zA-Z0-9_-]{32,}$/.test(apiKey);
  }

  /**
   * Sanitize SQL input (for parameterized queries)
   */
  static sanitizeSQLInput(input: string): string {
    // Note: This is for reference only. Always use parameterized queries instead.
    return input
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/\x00/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  }

  /**
   * Validate phone number
   */
  static validatePhoneNumber(phone: string): boolean {
    // Basic validation: should contain only digits, spaces, dashes, and parentheses
    const phoneRegex = /^[\d\s\-()+]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Validate credit card number (Luhn algorithm)
   */
  static validateCreditCard(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: any) => string;
}

/**
 * In-memory rate limiter (for single-instance deployments)
 */
export class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
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

/**
 * Redis-based rate limiter (for distributed deployments)
 */
export class RedisRateLimiter {
  private redisClient: any;
  private config: RateLimitConfig;

  constructor(redisClient: any, config: RateLimitConfig) {
    this.redisClient = redisClient;
    this.config = config;
  }

  async isAllowed(key: string): Promise<boolean> {
    try {
      const current = await this.redisClient.incr(key);

      if (current === 1) {
        await this.redisClient.expire(key, Math.ceil(this.config.windowMs / 1000));
      }

      return current <= this.config.maxRequests;
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open: allow request if rate limiter fails
      return true;
    }
  }

  async getRemainingRequests(key: string): Promise<number> {
    try {
      const current = await this.redisClient.get(key);
      const count = current ? parseInt(current, 10) : 0;
      return Math.max(0, this.config.maxRequests - count);
    } catch (error) {
      console.error('Rate limiter error:', error);
      return this.config.maxRequests;
    }
  }

  async getResetTime(key: string): Promise<number> {
    try {
      const ttl = await this.redisClient.ttl(key);
      if (ttl === -1) {
        return Date.now();
      }
      return Date.now() + ttl * 1000;
    } catch (error) {
      console.error('Rate limiter error:', error);
      return Date.now();
    }
  }
}

// ============================================================================
// CORS AND SECURITY HEADERS
// ============================================================================

/**
 * Generate secure CORS headers
 */
export function generateCORSHeaders(allowedOrigins: string[]): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigins.join(', '),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Generate security headers
 */
export function generateSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

// ============================================================================
// AUTHENTICATION AND AUTHORIZATION
// ============================================================================

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Verify JWT token (basic implementation)
 */
export function verifyJWT(token: string, secret: string): { valid: boolean; payload?: any } {
  try {
    // This is a simplified implementation. Use a proper JWT library in production.
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const signature = parts[2];

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) {
      return { valid: false };
    }

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return { valid: false };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false };
  }
}

// ============================================================================
// SECURITY AUDIT LOGGING
// ============================================================================

export interface SecurityAuditLog {
  timestamp: string;
  eventType: string;
  userId?: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  details?: Record<string, any>;
}

export class SecurityAuditLogger {
  private logs: SecurityAuditLog[] = [];
  private maxLogs = 10000;

  log(
    eventType: string,
    action: string,
    resource: string,
    result: 'success' | 'failure',
    userId?: string,
    details?: Record<string, any>
  ): void {
    const logEntry: SecurityAuditLog = {
      timestamp: new Date().toISOString(),
      eventType,
      userId,
      action,
      resource,
      result,
      details,
    };

    this.logs.push(logEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    console.log('[Security Audit]', logEntry);
  }

  getLogs(): SecurityAuditLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const securityAuditLogger = new SecurityAuditLogger();
