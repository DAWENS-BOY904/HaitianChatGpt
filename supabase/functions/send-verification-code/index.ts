import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in database (expires in 10 minutes)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create verification_codes table if needed (run this SQL in your database first)
    // create table public.verification_codes (
    //   id uuid primary key default gen_random_uuid(),
    //   email text not null,
    //   code text not null,
    //   type text not null,
    //   expires_at timestamp with time zone not null,
    //   used boolean default false,
    //   created_at timestamp with time zone default now()
    // );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await supabaseAdmin.from('verification_codes').insert({
      email,
      code,
      type: type || 'password_change',
      expires_at: expiresAt.toISOString(),
    });

    // In production, send email using your email service (SendGrid, AWS SES, etc.)
    // For now, we'll just log it
    console.log(`Verification code for ${email}: ${code}`);

    // TODO: Integrate with your email service
    // await sendEmail(email, 'Your Verification Code', `Your code is: ${code}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Verification code sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send verification code error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
