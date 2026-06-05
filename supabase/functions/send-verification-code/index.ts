/**
 * send-verification-code edge function
 *
 * Handles verification codes for REGULAR USERS only via Resend.
 * Admin authentication uses Supabase OTP directly — NOT this function.
 *
 * Supported types: "password_change", "email_change", "account_action"
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Rate limit: max 5 codes per email per hour
const MAX_CODES_PER_HOUR = 5;

// ── Blocked types: admin auth must NOT go through here ──
const BLOCKED_TYPES = ['admin_login'];

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error('[Resend] RESEND_API_KEY is not configured.');
    return { ok: false, error: 'Email service not configured. Contact support.' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Dawinix <code@dawinix.com>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Resend] Error [${res.status}]:`, errorText);
    return { ok: false, error: `Resend: ${errorText}` };
  }

  const data = await res.json();
  console.log('[Resend] Email sent, id:', data.id);
  return { ok: true };
}

Deno.serve(async (req) => {
  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type } = await req.json();

    // ── Validate email ──
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Block admin_login — must use Supabase OTP directly ──
    if (BLOCKED_TYPES.includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Admin authentication must use Supabase OTP, not this endpoint.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const codeType = type || 'password_change';
    const normalizedEmail = email.toLowerCase().trim();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Rate limiting ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('verification_codes')
      .select('*', { count: 'exact', head: true })
      .eq('email', normalizedEmail)
      .eq('type', codeType)
      .gte('created_at', oneHourAgo);

    if ((count ?? 0) >= MAX_CODES_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait before requesting another code.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Invalidate all previous unused codes for this email + type ──
    await supabaseAdmin
      .from('verification_codes')
      .update({ used: true })
      .eq('email', normalizedEmail)
      .eq('type', codeType)
      .eq('used', false);

    // ── Generate cryptographically secure 6-digit code ──
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const code = String(100000 + (array[0] % 900000));

    // ── Persist code (expires in 10 min) ──
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabaseAdmin.from('verification_codes').insert({
      email: normalizedEmail,
      code,
      type: codeType,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('[DB] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store verification code.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Build email HTML ──
    const subject = 'Your Verification Code — Dawinix';
    const html = `
      <!DOCTYPE html>
<html lang="${lang || 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 16px; }
    .card { background: #111111; border-radius: 20px; overflow: hidden; border: 1px solid #222222; }
    
    /* Header */
    .header { background: linear-gradient(135deg, #10A37F 0%, #0096FF 100%); padding: 40px 32px 32px; text-align: center; position: relative; }
    .header::after {
      content: '';
      position: absolute;
      bottom: -1px; left: 0; right: 0;
      height: 40px;
      background: linear-gradient(to bottom, transparent, #111111);
    }
    
    /* Map Logo */
    .logo-wrap {
      width: 72px; height: 72px;
      background: #ffffff;
      border-radius: 20px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      position: relative;
      z-index: 1;
    }
    .logo-wrap svg { width: 44px; height: 44px; }
    .brand-name { font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; position: relative; z-index: 1; }
    .brand-sub { font-size: 14px; color: rgba(255,255,255,0.75); margin-top: 6px; position: relative; z-index: 1; }
    
    /* Body */
    .body { padding: 32px; }
    .greeting { font-size: 18px; color: #cccccc; margin-bottom: 20px; line-height: 1.6; }
    .greeting strong { color: #ffffff; }
    .code-box {
      background: linear-gradient(145deg, #1a1a1a, #161616);
      border: 1px solid #333333;
      border-radius: 16px;
      padding: 32px;
      margin: 0 0 28px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .code-box::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: linear-gradient(90deg, #10A37F, #0096FF);
    }
    .code-label { color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 16px; font-weight: 600; }
    .code-value { color: #ffffff; font-size: 48px; font-weight: 700; letter-spacing: 14px; margin: 0; font-family: 'SF Mono', 'Courier New', monospace; text-shadow: 0 0 30px rgba(16,163,127,0.3); }
    .timer { color: #ff9f0a; font-size: 13px; margin-top: 16px; font-weight: 500; }
    .timer::before { content: '⏱ '; }
    
    /* Session Info */
    .session-info {
      background: #161616;
      border: 1px solid #222222;
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .session-title { font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 14px; font-weight: 600; }
    .session-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #1f1f1f; }
    .session-row:last-child { border-bottom: none; }
    .session-label { font-size: 13px; color: #888888; display: flex; align-items: center; gap: 8px; }
    .session-value { font-size: 13px; color: #ffffff; font-weight: 500; text-align: right; max-width: 55%; }
    .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .dot.green { background: #30d158; box-shadow: 0 0 6px rgba(48,209,88,0.4); }
    .dot.blue { background: #0a84ff; box-shadow: 0 0 6px rgba(10,132,255,0.4); }
    .dot.orange { background: #ff9f0a; box-shadow: 0 0 6px rgba(255,159,10,0.4); }
    
    /* Warning */
    .warning {
      background: rgba(255,69,58,0.08);
      border: 1px solid rgba(255,69,58,0.2);
      border-radius: 12px;
      padding: 16px 18px;
      margin-bottom: 8px;
    }
    .warning-text { font-size: 13px; color: #ff453a; line-height: 1.6; margin: 0; }
    .warning-text strong { color: #ff453a; }
    
    /* Divider */
    .divider { height: 1px; background: #1a1a1a; margin: 0 32px; }
    
    /* App Downloads */
    .app-section {
      padding: 28px 32px;
      text-align: center;
      background: #0d0d0d;
    }
    .app-title { font-size: 13px; color: #666666; margin-bottom: 16px; font-weight: 500; }
    .store-btns { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .store-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #1a1a1a;
      border: 1px solid #333333;
      border-radius: 10px;
      padding: 12px 20px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .store-btn:hover { border-color: #10A37F; background: #1f1f1f; }
    .store-btn svg { width: 22px; height: 22px; flex-shrink: 0; }
    .store-text { text-align: left; line-height: 1.2; }
    .store-sub { font-size: 9px; color: #666666; display: block; letter-spacing: 0.5px; text-transform: uppercase; }
    .store-main { font-size: 14px; color: #ffffff; font-weight: 600; display: block; }
    
    /* Language Bar */
    .lang-bar {
      text-align: center;
      padding: 16px 32px;
      font-size: 12px;
      color: #444444;
      background: #0d0d0d;
      border-top: 1px solid #1a1a1a;
    }
    .lang-bar a { color: #666666; text-decoration: none; margin: 0 10px; transition: color 0.2s; }
    .lang-bar a:hover { color: #10A37F; }
    .lang-bar .active { color: #10A37F; font-weight: 600; }
    
    /* Extended Footer */
    .footer {
      background: #080808;
      padding: 32px;
      text-align: center;
    }
    .footer-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .footer-brand svg { width: 20px; height: 20px; }
    .footer-brand span { font-size: 15px; font-weight: 700; color: #ffffff; }
    .footer-links { margin-bottom: 20px; }
    .footer-links a {
      color: #666666;
      text-decoration: none;
      font-size: 12px;
      margin: 0 12px;
      transition: color 0.2s;
    }
    .footer-links a:hover { color: #10A37F; }
    .footer-social { margin-bottom: 20px; }
    .footer-social a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px; height: 36px;
      background: #1a1a1a;
      border-radius: 50%;
      margin: 0 6px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .footer-social a:hover { background: #10A37F; }
    .footer-social svg { width: 16px; height: 16px; }
    .footer-legal {
      color: #333333;
      font-size: 11px;
      line-height: 1.8;
      margin-bottom: 16px;
    }
    .footer-legal a { color: #444444; text-decoration: none; }
    .footer-legal a:hover { color: #10A37F; }
    .footer-copy {
      color: #222222;
      font-size: 11px;
      margin: 0;
    }
    
    @media (max-width: 480px) {
      .wrapper { padding: 20px 12px; }
      .body, .footer { padding: 24px 20px; }
      .code-value { font-size: 36px; letter-spacing: 8px; }
      .store-btns { flex-direction: column; align-items: center; }
      .store-btn { width: 200px; justify-content: center; }
      .footer-links a { display: inline-block; margin: 4px 8px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      
      <!-- Header with Map Logo -->
      <div class="header">
        <div class="logo-wrap">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill="#ffffff"/>
            <path d="M24 8C17.37 8 12 13.37 12 20c0 8.33 12 20 12 20s12-11.67 12-20c0-6.63-5.37-12-12-12z" fill="url(#grad1)"/>
            <circle cx="24" cy="20" r="5" fill="#ffffff"/>
            <defs>
              <linearGradient id="grad1" x1="12" y1="8" x2="36" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#10A37F"/>
                <stop offset="1" stop-color="#0096FF"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="brand-name">Dawinix</div>
        <div class="brand-sub">Secure Verification</div>
      </div>
      
      <!-- Body -->
      <div class="body">
        <p class="greeting">
          Hello <strong>${username || 'there'}</strong>,<br>
          We received a request to verify your identity. Use the code below to complete your sign-in. This code was generated based on your current session details.
        </p>
        
        <!-- Code Box -->
        <div class="code-box">
          <p class="code-label">Your Verification Code</p>
          <p class="code-value">${code}</p>
          <p class="timer">Expires in 10 minutes — ${new Date(Date.now() + 600000).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</p>
        </div>
        
        <!-- Auto-Detected Session Info -->
        <div class="session-info">
          <p class="session-title">Session Details</p>
          <div class="session-row">
            <span class="session-label"><span class="dot green"></span> Date & Time</span>
            <span class="session-value">${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })}</span>
          </div>
          <div class="session-row">
            <span class="session-label"><span class="dot blue"></span> Location</span>
            <span class="session-value">${location || 'Port-au-Prince, Haiti'}</span>
          </div>
          <div class="session-row">
            <span class="session-label"><span class="dot orange"></span> Device</span>
            <span class="session-value">${platformLabel || 'Unknown Device'}</span>
          </div>
          <div class="session-row">
            <span class="session-label"><span class="dot green"></span> IP Address</span>
            <span class="session-value">${ipAddress || '192.168.x.x'}</span>
          </div>
        </div>
        
        <!-- Security Warning -->
        <div class="warning">
          <p class="warning-text">
            <strong>Didn't request this?</strong> If you did not initiate this verification, someone may be trying to access your account. Please <a href="https://dawinix.com/security" style="color:#ff453a;text-decoration:underline;">secure your account immediately</a> or contact our support team. Never share this code with anyone, including Dawinix HT support staff.
          </p>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <!-- App Downloads -->
      <div class="app-section">
        <p class="app-title">Get the Dawinix HT App</p>
        <div class="store-btns">
          <a href="https://apps.apple.com/app/dawinix-ht" class="store-btn" target="_blank">
            <svg viewBox="0 0 24 24" fill="#ffffff"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.98 1.07-3.11-1.05.05-2.31.71-3.06 1.55-.67.74-1.26 1.93-1.1 3.07 1.18.09 2.38-.6 3.09-1.51z"/></svg>
            <div class="store-text">
              <span class="store-sub">Download on the</span>
              <span class="store-main">App Store</span>
            </div>
          </a>
          <a href="https://play.google.com/store/apps/details?id=com.dawinix.ht" class="store-btn" target="_blank">
            <svg viewBox="0 0 24 24" fill="#ffffff"><path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.6 3 21.09 3 20.5ZM16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12ZM20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.5 12.92 20.16 13.19L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81ZM6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z"/></svg>
            <div class="store-text">
              <span class="store-sub">Get it on</span>
              <span class="store-main">Google Play</span>
            </div>
          </a>
        </div>
      </div>
      
      <!-- Language Bar -->
      <div class="lang-bar">
        <a href="https://dawinix.com?lang=en" class="active">English</a>
        <a href="https://dawinix.com?lang=ht">Kreyòl</a>
        <a href="https://dawinix.com?lang=fr">Français</a>
        <a href="https://dawinix.com?lang=es">Español</a>
      </div>
      
      <!-- Extended Footer -->
      <div class="footer">
        <div class="footer-brand">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#10A37F"/><circle cx="12" cy="9" r="2.5" fill="#ffffff"/></svg>
          <span>Dawinix</span>
        </div>
        
        <div class="footer-links">
          <a href="https://dawinix.com/about">About Us</a>
          <a href="https://dawinix.com/features">Features</a>
          <a href="https://dawinix.com/pricing">Pricing</a>
          <a href="https://dawinix.com/blog">Blog</a>
          <a href="https://dawinix.com/help">Help Center</a>
        </div>
        
        <div class="footer-social">
          <a href="https://twitter.com/dawinix" target="_blank" aria-label="Twitter">
            <svg viewBox="0 0 24 24" fill="#666666"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="https://instagram.com/dawinix" target="_blank" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="#666666"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
          </a>
          <a href="https://linkedin.com/company/dawinix" target="_blank" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" fill="#666666"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <a href="https://github.com/dawinix" target="_blank" aria-label="GitHub">
            <svg viewBox="0 0 24 24" fill="#666666"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
          </a>
        </div>
        
        <div class="footer-legal">
          Dawinix HT — Built for Haiti, Powered by AI.<br>
          <a href="https://dawinix.com/privacy">Privacy Policy</a> · 
          <a href="https://dawinix.com/terms">Terms of Service</a> · 
          <a href="https://dawinix.com/cookies">Cookie Policy</a> · 
          <a href="https://dawinix.com/security">Security</a> · 
          <a href="mailto:support@dawinix.com">support@dawinix.com</a><br>
          Dawinix S.A. · Port-au-Prince, Haiti · HT6110
        </div>
        
        <p class="footer-copy">© ${new Date().getFullYear()} Dawinix. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // ── Send via Resend ──
    const { ok, error: sendError } = await sendEmailViaResend(normalizedEmail, subject, html);

    if (!ok) {
      return new Response(
        JSON.stringify({ error: sendError || 'Failed to send verification email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-verification-code] Code delivered to ${normalizedEmail} (type: ${codeType})`);

    return new Response(
      JSON.stringify({ success: true, message: 'Verification code sent to your email.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-verification-code] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
