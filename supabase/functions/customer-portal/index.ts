import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const logStep = (step: string, details?: any) => {
  const d = details ? ` — ${JSON.stringify(details)}` : '';
  console.log(`[customer-portal] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header missing');
    const token = authHeader.replace('Bearer ', '');

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.email) throw new Error('Unauthorized');
    const user = userData.user;
    logStep('User authenticated', { userId: user.id, email: user.email });

    // ── Find Stripe customer ──
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email!)}&limit=1`,
      { headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Version': '2025-03-31.basil' } },
    );
    const searchData = await searchRes.json();

    if (!searchData?.data?.length) {
      throw new Error('No Stripe account found. Subscribe first.');
    }

    const customerId = searchData.data[0].id;
    logStep('Stripe customer found', { customerId });

    // ── Create billing portal session ──
    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2025-03-31.basil',
      },
      body: new URLSearchParams({
        customer: customerId,
        return_url: 'dawinixht://subscription',
      }).toString(),
    });

    const portalData = await portalRes.json();

    if (!portalRes.ok) {
      const errMsg = portalData?.error?.message || JSON.stringify(portalData);
      logStep('Stripe portal error', { errMsg });
      throw new Error(`Stripe: ${errMsg}`);
    }

    logStep('Portal session created', { sessionId: portalData.id });

    return new Response(
      JSON.stringify({ url: portalData.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: any) {
    logStep('Error', { message: error?.message });
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
