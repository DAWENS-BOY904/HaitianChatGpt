/**
 * send-verification-code edge function
 *
 * Actions:
 *   - send (default): Sends a 6-digit code via Resend API and stores it in DB.
 *   - verify: Checks the code against the DB using service role key (bypasses RLS).
 *
 * Supports types: login, registration, password_change, email_change, account_action
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CODE_EXPIRY_MINUTES = 10;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getEmailSubjectAndTitle(type: string): { subject: string; title: string; intro: string } {
  switch (type) {
    case 'registration':
      return {
        subject: 'Verify your Dawinix account',
        title: 'Confirm Your Email',
        intro: 'Welcome! Use the code below to verify your email address and complete your registration.',
      };
    case 'login':
      return {
        subject: 'Your Dawinix sign-in code',
        title: 'Sign-In Verification',
        intro: 'Use the code below to complete your sign-in. It expires in 10 minutes.',
      };
    case 'password_change':
      return {
        subject: 'Dawinix password change verification',
        title: 'Password Change Request',
        intro: 'We received a request to change your password. Enter the code below to confirm.',
      };
    case 'email_change':
      return {
        subject: 'Verify your new email – Dawinix',
        title: 'Email Change Verification',
        intro: 'Use the code below to verify your new email address.',
      };
    default:
      return {
        subject: 'Your Dawinix verification code',
        title: 'Verification Code',
        intro: 'Use the code below to complete the requested action.',
      };
  }
}

function buildEmailHtml(code: string, type: string, username?: string): string {
  const { title, intro } = getEmailSubjectAndTitle(type);
  const displayName = username || 'there';
  const year = new Date().getFullYear();

  const digits = code.split('').map(d =>
    `<span style="display:inline-block;width:52px;height:60px;line-height:60px;text-align:center;font-size:32px;font-weight:800;color:#ffffff;background:#1a1a1a;border:2px solid #333333;border-radius:12px;margin:0 4px;">${d}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#ffffff;">
  <div style="max-width:520px;margin:0 auto;padding:40px 16px;">
    <div style="background:#111111;border-radius:20px;overflow:hidden;border:1px solid #1e1e1e;">
      <div style="background:linear-gradient(135deg,#10A37F 0%,#0096FF 100%);padding:40px 32px 36px;text-align:center;">
        <div style="width:72px;height:72px;background:#ffffff;border-radius:20px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 6C16.27 6 10 12.27 10 20c0 9.94 14 22 14 22s14-12.06 14-22C38 12.27 31.73 6 24 6z" fill="url(#hg)"/>
            <circle cx="24" cy="20" r="5" fill="#ffffff"/>
            <defs><linearGradient id="hg" x1="10" y1="6" x2="38" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#10A37F"/><stop offset="1" stop-color="#0096FF"/></linearGradient></defs>
          </svg>
        </div>
        <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Dawinix</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;">AI Assistant · Haiti</div>
      </div>
      <div style="padding:36px 32px 28px;">
        <h1 style="font-size:22px;font-weight:700;color:#ffffff;margin:0 0 10px;">${title}</h1>
        <p style="font-size:15px;color:#aaaaaa;line-height:1.7;margin:0 0 8px;">
          Hi <strong style="color:#ffffff;">${displayName}</strong>,
        </p>
        <p style="font-size:15px;color:#aaaaaa;line-height:1.7;margin:0 0 32px;">${intro}</p>
        <div style="text-align:center;margin:0 0 28px;">
          <div style="margin-bottom:8px;">${digits}</div>
          <p style="font-size:12px;color:#555555;margin:12px 0 0;">Expires in ${CODE_EXPIRY_MINUTES} minutes</p>
        </div>
        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;display:flex;gap:12px;align-items:flex-start;">
          <span style="font-size:18px;flex-shrink:0;">🔒</span>
          <p style="font-size:13px;color:#888888;margin:0;line-height:1.6;">
            For your security, never share this code with anyone — including Dawinix support. We will <strong style="color:#ffffff;">never</strong> ask for your code.
          </p>
        </div>
        <p style="font-size:13px;color:#555555;margin:24px 0 0;line-height:1.6;">
          If you did not request this code, you can safely ignore this email.
        </p>
      </div>
      <div style="background:#080808;padding:24px 32px;text-align:center;border-top:1px solid #1a1a1a;">
        <p style="font-size:12px;color:#444444;margin:0 0 8px;">
          <a href="https://dawinix.com/privacy" style="color:#555555;text-decoration:none;margin:0 8px;">Privacy</a>
          <a href="https://dawinix.com/terms" style="color:#555555;text-decoration:none;margin:0 8px;">Terms</a>
          <a href="https://dawinix.com/help" style="color:#555555;text-decoration:none;margin:0 8px;">Help</a>
        </p>
        <p style="font-size:11px;color:#333333;margin:0;">© ${year} Dawinix HT · Port-au-Prince, Haiti</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action ?? 'send';

    // ── VERIFY action ─────────────────────────────────────────────────────────
    if (action === 'verify') {
      const { email, code } = body;

      if (!email || !code) {
        return new Response(
          JSON.stringify({ error: 'email and code are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedCode = code.trim();
      const now = new Date().toISOString();

      // Find the most recent unused, unexpired code for this email
      const { data: rows, error: fetchError } = await supabase
        .from('verification_codes')
        .select('id, code, expires_at, used')
        .eq('email', normalizedEmail)
        .eq('used', false)
        .gte('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(5);

      if (fetchError) {
        console.error('[send-verification-code] verify fetch error:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify code. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!rows || rows.length === 0) {
        console.log(`[send-verification-code] No valid codes found for ${normalizedEmail}`);
        return new Response(
          JSON.stringify({ error: 'Code expired or not found. Please request a new one.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if any of the valid codes match
      const matchedRow = rows.find((r: any) => r.code === normalizedCode);

      if (!matchedRow) {
        console.log(`[send-verification-code] Code mismatch for ${normalizedEmail}`);
        return new Response(
          JSON.stringify({ error: 'Incorrect code. Please check and try again.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as used
      await supabase
        .from('verification_codes')
        .update({ used: true })
        .eq('id', matchedRow.id);

      console.log(`[send-verification-code] Code verified for ${normalizedEmail}`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── CREATE-SESSION action ───────────────────────────────────────────────────
    if (action === 'create-session') {
      const { email } = body;
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'email is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const normalizedEmail = email.toLowerCase().trim();

      const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
      });

      if (error || !data?.properties?.hashed_token) {
        console.error('[send-verification-code] generateLink error:', error);
        return new Response(
          JSON.stringify({ error: error?.message ?? 'Failed to create session.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[send-verification-code] Session token created for ${normalizedEmail}`);
      return new Response(
        JSON.stringify({ success: true, token_hash: data.properties.hashed_token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── SEND action (default) ─────────────────────────────────────────────────
    const { email, type = 'login', username } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validTypes = ['login', 'registration', 'password_change', 'email_change', 'account_action'];
    const normalizedType = validTypes.includes(type) ? type : 'login';
    const resolvedType = normalizedType;

    if (!RESEND_API_KEY) {
      console.error('[send-verification-code] RESEND_API_KEY not configured.');
      return new Response(
        JSON.stringify({ error: 'Email service not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: dbError } = await supabase.from('verification_codes').insert({
      email: email.toLowerCase().trim(),
      code,
      type: resolvedType,
      expires_at: expiresAt,
      used: false,
    });

    if (dbError) {
      console.error('[send-verification-code] DB insert error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to create verification code.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { subject } = getEmailSubjectAndTitle(resolvedType);
    const html = buildEmailHtml(code, resolvedType, username);

    const resendRes = await fetch('https://api.resend.com/emails', {
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

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error(`[send-verification-code] Resend error [${resendRes.status}]:`, errText);
      return new Response(
        JSON.stringify({ error: `Resend: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendData = await resendRes.json();
    console.log(`[send-verification-code] Code sent to ${email} (type: ${resolvedType}), id: ${resendData.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[send-verification-code] Unhandled error:', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
