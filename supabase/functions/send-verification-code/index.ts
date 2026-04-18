import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Rate limit: max 5 codes per email per hour
const MAX_CODES_PER_HOUR = 5;

async function sendEmailViaResend(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Haitian ChatGPT <noreply@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Resend error [${res.status}]:`, errorText);
    return false;
  }

  const data = await res.json();
  console.log('Email sent via Resend:', data.id);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'A valid email address is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Rate limiting: block if too many codes sent in the last hour ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('verification_codes')
      .select('*', { count: 'exact', head: true })
      .eq('email', normalizedEmail)
      .eq('type', type || 'password_change')
      .gte('created_at', oneHourAgo);

    if ((count ?? 0) >= MAX_CODES_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait before requesting another code.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Invalidate all previous unused codes for this email+type ──
    await supabaseAdmin
      .from('verification_codes')
      .update({ used: true })
      .eq('email', normalizedEmail)
      .eq('type', type || 'password_change')
      .eq('used', false);

    // ── Generate cryptographically random 6-digit code ──
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const code = String(100000 + (array[0] % 900000));

    // ── Store code (expires in 10 min) ──
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabaseAdmin.from('verification_codes').insert({
      email: normalizedEmail,
      code,
      type: type || 'password_change',
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error('DB insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store verification code.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Build email content based on type ──
    const isAdminLogin = type === 'admin_login';
    const subject = isAdminLogin ? 'Admin Login Verification Code' : 'Your Verification Code';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid #222222;overflow:hidden;">
                  <tr>
                    <td style="padding:40px 40px 32px;text-align:center;">
                      <div style="width:56px;height:56px;background:linear-gradient(135deg,#10A37F,#0096FF);border-radius:50%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;">
                        <span style="font-size:28px;">✦</span>
                      </div>
                      <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;">Haitian ChatGPT</h1>
                      <p style="color:#888888;font-size:15px;margin:0 0 32px;">${isAdminLogin ? 'Admin Login Verification' : 'Verification Code'}</p>
                      
                      <p style="color:#cccccc;font-size:15px;margin:0 0 24px;line-height:1.6;">
                        ${isAdminLogin
                          ? 'Use the code below to complete your admin login. This code expires in <strong style="color:#ffffff;">10 minutes</strong>.'
                          : 'Use the code below to verify your identity. This code expires in <strong style="color:#ffffff;">10 minutes</strong>.'}
                      </p>
                      
                      <div style="background:#1a1a1a;border:1px solid #333333;border-radius:12px;padding:28px;margin:0 0 32px;">
                        <p style="color:#888888;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Your verification code</p>
                        <p style="color:#ffffff;font-size:42px;font-weight:700;letter-spacing:10px;margin:0;font-family:'Courier New',monospace;">${code}</p>
                      </div>
                      
                      <p style="color:#666666;font-size:13px;margin:0;line-height:1.6;">
                        If you did not request this code, please ignore this email.<br>
                        Never share this code with anyone.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#0d0d0d;border-top:1px solid #1a1a1a;padding:20px 40px;text-align:center;">
                      <p style="color:#444444;font-size:12px;margin:0;">© 2025 Haitian ChatGPT. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // ── Send via Resend ──
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured.');
      return new Response(
        JSON.stringify({ error: 'Email service not configured. Contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sent = await sendEmailViaResend(normalizedEmail, subject, html);

    if (!sent) {
      return new Response(
        JSON.stringify({ error: 'Failed to send verification email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-verification-code] Code sent to ${normalizedEmail} (type: ${type})`);

    return new Response(
      JSON.stringify({ success: true, message: 'Verification code sent to your email.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('send-verification-code error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
