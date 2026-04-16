import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, platform, loginTime } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Format date nicely
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

    const platformLabel = platform === 'ios'
      ? 'iOS (iPhone / iPad)'
      : platform === 'android'
      ? 'Android'
      : 'Web Browser';

    // Get username from user_profiles
    let username = email.split('@')[0];
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('username, full_name')
        .eq('id', userId)
        .single();
      if (profile?.full_name) username = profile.full_name;
      else if (profile?.username) username = profile.username;
    }

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
    .notice { background: rgba(255, 159, 10, 0.15); border: 1px solid rgba(255, 159, 10, 0.3); border-radius: 10px; padding: 14px; margin-top: 20px; }
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

    // Attempt to send via RESEND if configured, else log
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
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
      console.log('Resend result:', result);
    } else if (SENDGRID_API_KEY) {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: 'noreply@dawinix.com', name: 'Haitian AI' },
          subject: '✅ Successful Sign-In to Haitian AI',
          content: [{ type: 'text/html', value: emailHTML }],
        }),
      });
    } else {
      // Log for dev (configure RESEND_API_KEY or SENDGRID_API_KEY in Secrets)
      console.log(`[send-login-email] Would send to ${email}:`, {
        subject: 'Successful Sign-In',
        platform,
        loginTime: formattedDate,
      });
    }

    // Log the login event in activity_logs
    if (userId) {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'user_login',
        action_type: 'auth',
        details: { platform, loginTime, email },
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('send-login-email error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
