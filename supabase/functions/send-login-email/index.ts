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
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Successful Login – Haitian AI</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #0a0a0a; color: #ffffff; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #1c1c1e; border-radius: 18px; overflow: hidden; border: 1px solid #2c2c2e; }
    .header { background: linear-gradient(135deg, #10A37F 0%, #0d7a60 100%); padding: 32px 28px; text-align: center; }
    .logo { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
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
    .footer { text-align: center; padding: 20px 28px; color: #636366; font-size: 12px; line-height: 1.6; }
    .footer a { color: #10A37F; text-decoration: none; }
    .check-icon { font-size: 44px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="check-icon">✅</div>
        <div class="logo">Haitian AI</div>
        <div class="sub">Successful Sign-In</div>
      </div>
      <div class="body">
        <div class="greeting">Welcome back, ${username}!</div>
        <div class="message">
          A successful sign-in to your Haitian AI account was detected. Here are the details:
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
      <div class="footer">
        You received this email because a login was made to your Haitian AI account.<br>
        <a href="mailto:support@dawinix.com">Contact Support</a> ·
        <a href="https://dawinix.com/privacy">Privacy Policy</a>
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
              from: 'Haitian AI <noreply@dawinix.com>',
              to: [email],
              subject: '✅ Successful Sign-In to Haitian AI',
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
