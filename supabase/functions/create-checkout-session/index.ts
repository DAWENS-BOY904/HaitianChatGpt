import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ── Real Stripe price IDs (monthly recurring subscriptions) ──
const PRICE_MAP: Record<string, string> = {
  go:   'price_1SjmtpE0VkO7z1Vn1lpvP0PC', // $10/month – Premium Monthly
  plus: 'price_1ShK60E0VkO7z1VnHAKICksq', // $20/month – Premium Yearly monthly price
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` — ${JSON.stringify(details)}` : '';
  console.log(`[create-checkout-session] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Parse body ──
    let body: any;
    try { body = await req.json(); }
    catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { plan, priceId: rawPriceId } = body;
    logStep('Request received', { plan, rawPriceId });

    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    logStep('User authenticated', { userId: user.id, email: user.email });

    // ── Stripe key ──
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve price ID ──
    // 1. Use directly-provided priceId if it looks like a real Stripe price
    // 2. Otherwise map from plan name
    // 3. Fall back to PRICE_MAP['go']
    let resolvedPriceId: string = '';
    if (rawPriceId && String(rawPriceId).startsWith('price_')) {
      resolvedPriceId = rawPriceId;
    } else if (plan && PRICE_MAP[plan]) {
      resolvedPriceId = PRICE_MAP[plan];
    } else {
      resolvedPriceId = PRICE_MAP['go'];
    }
    logStep('Resolved price', { resolvedPriceId });

    // ── User email ──
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('email')
      .eq('id', user.id)
      .single();
    const userEmail = profile?.email || user.email || '';

    // ── Find or create Stripe customer ──
    // Search by email first so we reuse the same customer object
    let customerId: string | undefined;
    const customerSearchRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(userEmail)}&limit=1`,
      { headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Version': '2025-03-31.basil' } },
    );
    const customerSearchData = await customerSearchRes.json();
    if (customerSearchData?.data?.length > 0) {
      customerId = customerSearchData.data[0].id;
      logStep('Existing Stripe customer found', { customerId });
    } else {
      // Create new customer
      const createCustomerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2025-03-31.basil',
        },
        body: new URLSearchParams({
          email: userEmail,
          'metadata[user_id]': user.id,
          'metadata[plan]': plan || resolvedPriceId,
        }).toString(),
      });
      const newCustomer = await createCustomerRes.json();
      customerId = newCustomer?.id;
      logStep('New Stripe customer created', { customerId });
    }

    // ── Build Stripe Checkout Session (subscription mode) ──
    // NOTE: payment_method_types: ['card'] is the ONLY valid value via API.
    // Apple Pay & Google Pay work automatically on Stripe's hosted checkout page
    // when enabled in the Stripe Dashboard (no extra code needed).
    const params = new URLSearchParams({
      mode: 'subscription',
      'payment_method_types[0]': 'card',   // Apple Pay/Google Pay handled automatically by Stripe
      'line_items[0][price]': resolvedPriceId,
      'line_items[0][quantity]': '1',
      success_url: 'dawinixht://subscription/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  'dawinixht://subscription/cancel',
      'client_reference_id': user.id,
      'metadata[user_id]': user.id,
      'metadata[plan]': plan || resolvedPriceId,
      allow_promotion_codes: 'true',
      // Ask for billing address (required for some card types)
      'billing_address_collection': 'auto',
    });

    if (customerId) {
      params.set('customer', customerId);
    } else {
      params.set('customer_email', userEmail);
    }

    logStep('Creating Stripe checkout session');
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2025-03-31.basil',
      },
      body: params.toString(),
    });

    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      const errMsg = stripeData?.error?.message || JSON.stringify(stripeData);
      logStep('Stripe API error', { status: stripeRes.status, errMsg });
      return new Response(
        JSON.stringify({ error: `Stripe: ${errMsg}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    logStep('Checkout session created', { sessionId: stripeData.id, customerId });

    // ── Pre-record pending subscription in DB (will be confirmed by check-subscription) ──
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Store stripe_customer_id on user profile for quick lookup later
    await supabaseAdmin
      .from('user_profiles')
      .update({ billing_info: { stripe_customer_id: customerId } } as any)
      .eq('id', user.id)
      .catch(() => {});

    // Log activity (non-blocking)
    await supabaseAdmin.from('activity_logs').insert({
      user_id: user.id,
      action: 'checkout_session_created',
      action_type: 'payment',
      details: { sessionId: stripeData.id, plan: plan || resolvedPriceId, customerId },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ url: stripeData.url, sessionId: stripeData.id }),
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
