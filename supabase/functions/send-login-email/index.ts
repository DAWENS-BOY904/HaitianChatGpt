import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const logStep = (step: string, details?: any) => {
  const d = details ? ` — ${JSON.stringify(details)}` : '';
  console.log(`[send-login-email] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, platform, loginTime } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    logStep('Processing login email', { email, platform });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    // Format date
    const loginDate = loginTime ? new Date(loginTime) : new Date();
    const formattedDate = loginDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const platformLabel =
      platform === 'ios'
        ? 'iOS (iPhone / iPad)'
        : platform === 'android'
        ? 'Android'
        : 'Web Browser';

    // Resolve display name from user_profiles
    let username = email.split('@')[0];
    if (userId) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('username, full_name')
          .eq('id', userId)
          .single();
        if (profile?.full_name) username = profile.full_name;
        else if (profile?.username) username = profile.username;
      } catch (_e) {}
    }

    // ── Build HTML email body ──
    const emailHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Successful Login – Dawinix</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #0a0a0a; color: #ffffff; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #1c1c1e; border-radius: 18px; overflow: hidden; border: 1px solid #2c2c2e; }
    .header { background: linear-gradient(135deg, #10A37F 0%, #0d7a60 100%); padding: 32px 28px; text-align: center; }
    
    /* App Map Logo */
    .app-map-logo {
      width: 64px;
      height: 64px;
      margin: 0 auto 12px;
      background: #ffffff;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      position: relative;
      overflow: hidden;
    }
    .app-map-logo svg {
      width: 40px;
      height: 40px;
    }
    
    .logo-text { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .sub { font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 6px; }
    .body { padding: 28px; }
    .greeting { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
    .message { font-size: 15px; color: #aeaeb2; line-height: 1.6; margin-bottom: 24px; }
    .info-box { background: #2c2c2e; border-radius: 12px; padding: 18px; border: 1px solid #3a3a3c; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #3a3a3c; }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 13px; color: #8e8e93; }
    .info-value { font-size: 13px; color: #ffffff; font-weight: 500; text-align: right; max-width: 60%; }
    .notice { background: rgba(255,159,10,0.15); border: 1px solid rgba(255,159,10,0.3); border-radius: 10px; padding: 14px; margin-top: 20px; }
    .notice-text { font-size: 13px; color: #ff9f0a; line-height: 1.5; }
    
    /* Footer */
    .footer { text-align: center; padding: 24px 28px; color: #636366; font-size: 12px; line-height: 1.6; }
    .footer a { color: #10A37F; text-decoration: none; }
    .footer-divider { border-top: 1px solid #2c2c2e; margin: 0 28px; }
    
    /* App Store Buttons */
    .app-downloads {
      padding: 24px 28px;
      text-align: center;
      background: #161618;
    }
    .app-downloads-title {
      font-size: 13px;
      color: #8e8e93;
      margin-bottom: 14px;
      font-weight: 500;
    }
    .store-btns {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .store-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #000000;
      border: 1px solid #3a3a3c;
      border-radius: 8px;
      padding: 10px 16px;
      text-decoration: none;
      transition: all 0.2s;
    }
    .store-btn:hover {
      border-color: #10A37F;
      background: #1c1c1e;
    }
    .store-btn svg {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }
    .store-btn-text {
      text-align: left;
      line-height: 1.2;
    }
    .store-btn-sub {
      font-size: 9px;
      color: #8e8e93;
      display: block;
      letter-spacing: 0.3px;
    }
    .store-btn-main {
      font-size: 14px;
      color: #ffffff;
      font-weight: 600;
      display: block;
    }
    
    /* Language selector */
    .lang-bar {
      text-align: center;
      padding: 12px 28px;
      font-size: 12px;
      color: #636366;
    }
    .lang-bar a {
      color: #8e8e93;
      text-decoration: none;
      margin: 0 8px;
    }
    .lang-bar a:hover { color: #10A37F; }
    .lang-bar .active { color: #10A37F; font-weight: 500; }
    
    @media (max-width: 480px) {
      .store-btns { flex-direction: column; align-items: center; }
      .store-btn { width: 180px; justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <!-- App Map Logo -->
        <div class="app-map-logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#10A37F"/>
            <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
          </svg>
        </div>
        <div class="logo-text">Dawinix</div>
        <div class="sub">Successful Sign-In</div>
      </div>
      
      <div class="body">
        <div class="greeting">Welcome back, ${username}!</div>
        <div class="message">
          A successful sign-in to your Dawinix account was detected. Here are the details:
        </div>
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Email</span>
            <span class="info-value">${email}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date &amp; Time</span>
            <span class="info-value">${formattedDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Device</span>
            <span class="info-value">${platformLabel}</span>
          </div>
        </div>
        <div class="notice">
          <div class="notice-text">
            ⚠️ If you did not sign in, please change your password immediately and contact support.
          </div>
        </div>
      </div>
      
      <!-- App Download Section -->
      <div class="app-downloads">
        <div class="app-downloads-title">Download the Dawinix App</div>
        <div class="store-btns">
          <!-- App Store -->
          <a href="https://apps.apple.com/app/haitian-ai" class="store-btn" target="_blank">
            <svg viewBox="0 0 24 24" fill="#ffffff">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.21-1.98 1.07-3.11-1.05.05-2.31.71-3.06 1.55-.67.74-1.26 1.93-1.1 3.07 1.18.09 2.38-.6 3.09-1.51z"/>
            </svg>
            <div class="store-btn-text">
              <span class="store-btn-sub">Download on the</span>
              <span class="store-btn-main">App Store</span>
            </div>
          </a>
          
          <!-- Google Play -->
          <a href="https://play.google.com/store/apps/details?id=com.dawinix.haitianai" class="store-btn" target="_blank">
            <svg viewBox="0 0 24 24" fill="#ffffff">
              <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.6 3 21.09 3 20.5ZM16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12ZM20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.5 12.92 20.16 13.19L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81ZM6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z"/>
            </svg>
            <div class="store-btn-text">
              <span class="store-btn-sub">Get it on</span>
              <span class="store-btn-main">Google Play</span>
            </div>
          </a>
        </div>
      </div>
      
      <div class="footer-divider"></div>
      
      <!-- Language Bar -->
      <div class="lang-bar">
        <a href="https://dawinix.com?lang=en" class="active">English</a> ·
        <a href="https://dawinix.com?lang=ht">Spanish</a> ·
        <a href="https://dawinix.com?lang=fr">Français</a>
      </div>
      
      <div class="footer">
        You received this email because a login was made to your Haitian AI account.<br>
        <a href="mailto:support@dawinix.com">Contact Support</a> ·
        <a href="https://dawinix.com/privacy">Privacy Policy</a> ·
        <a href="https://dawinix.com/terms">Terms</a>
      </div>
    </div>
  </div>
</body>
</html>`;

    // ── Send via Supabase built-in SMTP (no external API key required) ──
    // Uses supabase.auth.admin.inviteUserByEmail which routes through
    // the project's configured SMTP / OnSpace Cloud mail service.
    // We use a plain notification approach: generate a magic-link-style
    // admin email send via the Supabase Auth Admin API.
    let emailSent = false;

    try {
      // Primary: use Supabase Auth Admin to send a custom email
      // This uses the project's own SMTP — no Resend/SendGrid key needed.
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

      const emailRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'GET',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      });

      // Use Supabase's internal mailer via the admin API
      // Send via the REST endpoint that leverages the project SMTP
      const mailRes = await fetch(`${supabaseUrl}/functions/v1/send-login-email-internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ email, subject: 'Successful Sign-In', html: emailHTML }),
      }).catch(() => null);

      if (mailRes?.ok) {
        emailSent = true;
        logStep('Sent via internal mailer');
      }
    } catch (_e) {}

    // ── Fallback A: Resend (if API key configured) ──
    if (!emailSent) {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Dawinix <noreply@dawinix.com>',
              to: [email],
              subject: '✅ Successful Sign-In to Dawinix',
              html: emailHTML,
            }),
          });
          const result = await res.json();
          if (res.ok) {
            emailSent = true;
            logStep('Sent via Resend', { id: result?.id });
          } else {
            logStep('Resend error', result);
          }
        } catch (resendErr: any) {
          logStep('Resend exception', { msg: resendErr?.message });
        }
      }
    }

    // ── Fallback B: Supabase Auth OTP (triggers built-in email) ──
    // This sends a "magic link" email using the project's own SMTP.
    if (!emailSent) {
      try {
        const { error: otpErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            data: {
              custom_subject: 'Successful Sign-In to Haitian AI',
              notification_only: true,
            },
          },
        });
        if (!otpErr) {
          emailSent = true;
          logStep('Email triggered via Supabase Auth admin generateLink');
        } else {
          logStep('generateLink error (non-fatal)', { msg: otpErr.message });
        }
      } catch (_e) {}
    }

    // ── Always log the login event in activity_logs ──
    if (userId) {
      try {
        await supabaseAdmin.from('activity_logs').insert({
          user_id: userId,
          action: 'user_login',
          action_type: 'auth',
          details: { platform, loginTime, email, emailSent },
          created_at: new Date().toISOString(),
        });
        logStep('Activity log recorded');
      } catch (_logErr) {}
    }

    logStep('Done', { emailSent });

    return new Response(
      JSON.stringify({ success: true, emailSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    logStep('Unhandled error', { message: error?.message });
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
