/**
 * send-welcome-email edge function
 *
 * Sends a branded welcome email to a newly registered user via Resend API.
 * Greets user by name, confirms account creation, and includes a get-started link.
 */

import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, username } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      console.warn('[send-welcome-email] RESEND_API_KEY not configured — skipping.');
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const displayName = username || email.split('@')[0] || 'there';
    const year = new Date().getFullYear();

    const subject = `Welcome to Dawinix 🎉`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 16px; }
    .card { background: #111111; border-radius: 20px; overflow: hidden; border: 1px solid #222222; }

    /* Hero Header */
    .header {
      background: linear-gradient(135deg, #10A37F 0%, #0096FF 100%);
      padding: 48px 32px 40px;
      text-align: center;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -1px; left: 0; right: 0;
      height: 40px;
      background: linear-gradient(to bottom, transparent, #111111);
    }
    .logo-wrap {
      width: 80px; height: 80px;
      background: #ffffff;
      border-radius: 22px;
      margin: 0 auto 20px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      position: relative; z-index: 1;
    }
    .logo-wrap svg { width: 50px; height: 50px; }
    .brand-name { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; position: relative; z-index: 1; }
    .brand-sub { font-size: 15px; color: rgba(255,255,255,0.8); margin-top: 6px; position: relative; z-index: 1; }

    /* Body */
    .body { padding: 36px 32px 28px; }

    .welcome-heading {
      font-size: 26px; font-weight: 700; color: #ffffff;
      margin: 0 0 12px; line-height: 1.3;
    }
    .welcome-sub {
      font-size: 16px; color: #aaaaaa; line-height: 1.7; margin: 0 0 32px;
    }
    .welcome-sub strong { color: #ffffff; }

    /* Feature list */
    .features { margin: 0 0 32px; }
    .feature-row {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 14px 0; border-bottom: 1px solid #1a1a1a;
    }
    .feature-row:last-child { border-bottom: none; }
    .feature-icon {
      width: 40px; height: 40px; flex-shrink: 0;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .feat-teal  { background: rgba(16,163,127,0.15); }
    .feat-blue  { background: rgba(0,150,255,0.15); }
    .feat-purple{ background: rgba(175,82,222,0.15); }
    .feat-orange{ background: rgba(255,159,10,0.15); }
    .feature-text { flex: 1; }
    .feature-title { font-size: 15px; font-weight: 600; color: #ffffff; margin: 0 0 3px; }
    .feature-desc  { font-size: 13px; color: #888888; margin: 0; line-height: 1.5; }

    /* CTA */
    .cta-wrap { text-align: center; margin: 32px 0 0; }
    .cta-btn {
      display: inline-block;
      background: linear-gradient(135deg, #10A37F, #0096FF);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 16px; font-weight: 700;
      padding: 16px 40px;
      border-radius: 50px;
      letter-spacing: 0.2px;
      box-shadow: 0 8px 24px rgba(16,163,127,0.3);
    }
    .cta-sub { margin-top: 12px; font-size: 13px; color: #555555; }

    /* Divider */
    .divider { height: 1px; background: #1a1a1a; }

    /* App Downloads */
    .app-section { padding: 28px 32px; text-align: center; background: #0d0d0d; }
    .app-title { font-size: 13px; color: #666666; margin-bottom: 16px; font-weight: 500; }
    .store-btns { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
    .store-btn {
      display: inline-flex; align-items: center; gap: 10px;
      background: #1a1a1a; border: 1px solid #333333;
      border-radius: 10px; padding: 12px 20px; text-decoration: none;
    }
    .store-btn svg { width: 22px; height: 22px; flex-shrink: 0; }
    .store-sub  { font-size: 9px; color: #666666; display: block; letter-spacing: 0.5px; text-transform: uppercase; }
    .store-main { font-size: 14px; color: #ffffff; font-weight: 600; display: block; }

    /* Footer */
    .footer { background: #080808; padding: 28px 32px; text-align: center; }
    .footer-brand {
      display: flex; align-items: center; justify-content: center;
      gap: 10px; margin-bottom: 16px;
    }
    .footer-brand svg { width: 20px; height: 20px; }
    .footer-brand span { font-size: 15px; font-weight: 700; color: #ffffff; }
    .footer-links a {
      color: #555555; text-decoration: none; font-size: 12px; margin: 0 10px;
    }
    .footer-copy { color: #333333; font-size: 11px; margin-top: 16px; }

    @media (max-width: 480px) {
      .wrapper { padding: 20px 12px; }
      .body, .footer { padding: 24px 20px; }
      .store-btns { flex-direction: column; align-items: center; }
      .store-btn { width: 200px; justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">

      <!-- Header -->
      <div class="header">
        <div class="logo-wrap">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill="#ffffff"/>
            <path d="M24 8C17.37 8 12 13.37 12 20c0 8.33 12 20 12 20s12-11.67 12-20c0-6.63-5.37-12-12-12z" fill="url(#g1)"/>
            <circle cx="24" cy="20" r="5" fill="#ffffff"/>
            <defs>
              <linearGradient id="g1" x1="12" y1="8" x2="36" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#10A37F"/>
                <stop offset="1" stop-color="#0096FF"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="brand-name">DawinixT</div>
        <div class="brand-sub">Your AI Assistant, Powered by Dawine</div>
      </div>

      <!-- Body -->
      <div class="body">
        <h1 class="welcome-heading">Welcome, <strong>${displayName}</strong>! 🎉</h1>
        <p class="welcome-sub">
          Your account has been created successfully. You now have access to a powerful AI assistant built for Haiti — available in <strong>English</strong>, <strong>Kreyòl</strong>, and <strong>Français</strong>.
        </p>

        <!-- Features -->
        <div class="features">
          <div class="feature-row">
            <div class="feature-icon feat-teal">💬</div>
            <div class="feature-text">
              <p class="feature-title">AI-Powered Chat</p>
              <p class="feature-desc">Ask anything — get smart, context-aware answers instantly.</p>
            </div>
          </div>
          <div class="feature-row">
            <div class="feature-icon feat-blue">🖼️</div>
            <div class="feature-text">
              <p class="feature-title">Image Understanding</p>
              <p class="feature-desc">Upload photos and let the AI analyze, describe, or extract information.</p>
            </div>
          </div>
          <div class="feature-row">
            <div class="feature-icon feat-purple">🎙️</div>
            <div class="feature-text">
              <p class="feature-title">Voice Mode</p>
              <p class="feature-desc">Speak naturally and hear AI responses in multiple voices.</p>
            </div>
          </div>
          <div class="feature-row">
            <div class="feature-icon feat-orange">🔍</div>
            <div class="feature-text">
              <p class="feature-title">Deep Research & Web Search</p>
              <p class="feature-desc">Get up-to-date answers with real-time web search capabilities.</p>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div class="cta-wrap">
          <a href="https://dawinix.com/home" class="cta-btn">Start Chatting Now →</a>
          <p class="cta-sub">No setup needed — you're ready to go.</p>
        </div>
      </div>

      <div class="divider"></div>

      <!-- App Downloads -->
      <div class="app-section">
        <p class="app-title">Also available on mobile</p>
        <div class="store-btns">
          <a href="https://apps.apple.com/app/dawinix-ht" class="store-btn" target="_blank">
            <svg viewBox="0 0 24 24" fill="#ffffff"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.98 1.07-3.11-1.05.05-2.31.71-3.06 1.55-.67.74-1.26 1.93-1.1 3.07 1.18.09 2.38-.6 3.09-1.51z"/></svg>
            <div>
              <span class="store-sub">Download on the</span>
              <span class="store-main">App Store</span>
            </div>
          </a>
          <a href="https://play.google.com/store/apps/details?id=com.dawinix.ht" class="store-btn" target="_blank">
            <svg viewBox="0 0 24 24" fill="#ffffff"><path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.6 3 21.09 3 20.5ZM16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12ZM20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.5 12.92 20.16 13.19L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81ZM6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z"/></svg>
            <div>
              <span class="store-sub">Get it on</span>
              <span class="store-main">Google Play</span>
            </div>
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-brand">
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#10A37F"/><circle cx="12" cy="9" r="2.5" fill="#ffffff"/></svg>
          <span>Dawinix HT</span>
        </div>
        <div class="footer-links">
          <a href="https://dawinix.com/privacy">Privacy Policy</a>
          <a href="https://dawinix.com/terms">Terms of Service</a>
          <a href="https://dawinix.com/help">Help Center</a>
          <a href="mailto:support@dawinix.com">Contact</a>
        </div>
        <p class="footer-copy">© ${year} Dawinix HT. All rights reserved. Port-au-Prince, Haiti.</p>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Dawinix <noreply@dawinix.com>',
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[send-welcome-email] Resend error [${res.status}]:`, errText);
      // Non-fatal — account was already created
      return new Response(
        JSON.stringify({ success: true, warning: 'Welcome email failed to send.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json();
    console.log(`[send-welcome-email] Sent to ${email}, id: ${data.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[send-welcome-email] Unhandled error:', err);
    // Non-fatal
    return new Response(
      JSON.stringify({ success: true, warning: err?.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
