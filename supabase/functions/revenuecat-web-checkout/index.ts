/**
 * revenuecat-web-checkout
 * Creates a RevenueCat web billing checkout session via the RC REST API v2.
 * Falls back to Stripe hosted checkout if RC web billing is not configured.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const log = (step: string, details?: any) => {
  const d = details ? ` — ${JSON.stringify(details)}` : '';
  console.log(`[rc-web-checkout] ${step}${d}`);
};

// ── Product ID map  plan + billing cycle → RC product identifier ──────────
const RC_PRODUCT_MAP: Record<string, string> = {
  'go_monthly':    'app.dawinix.go.monthly',
  'go_annual':     'app.dawinix.go.annual',
  'plus_monthly':  'app.dawinix.plus.monthly',
  'plus_annual':   'app.dawinix.plus.annual',
};

// ── Stripe price IDs (fallback) ───────────────────────────────────────────
const STRIPE_PRICE_MAP: Record<string, string> = {
  go:   'price_1SjmtpE0VkO7z1Vn1lpvP0PC',
  plus: 'price_1TPUrzE0VkO7z1Vnlgj45978',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── Parse body ────────────────────────────────────────────────────────
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore empty body */ }

    const { plan = 'plus', billingCycle = 'annual' } = body;
    log('Request', { plan, billingCycle });

    // ── Auth ──────────────────────────────────────────────────────────────
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    log('Authenticated', { userId: user.id });

    // ── RevenueCat keys ───────────────────────────────────────────────────
    // RC secret key (from dashboard → API Keys → Secret)
    const rcSecretKey = Deno.env.get('REVENUECAT_SECRET_KEY')
      || Deno.env.get('REVENUECAT_IOS_KEY')
      || '';

    const productKey = `${plan}_${billingCycle}` as keyof typeof RC_PRODUCT_MAP;
    const productId = RC_PRODUCT_MAP[productKey] || RC_PRODUCT_MAP['plus_annual'];

    // ── Try RevenueCat Web Billing API v2 ─────────────────────────────────
    if (rcSecretKey) {
      try {
        // Step 1: Get or create RC subscriber
        const subscriberRes = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${rcSecretKey}`,
              'Content-Type': 'application/json',
              'X-Platform': 'web',
            },
          },
        );
        const subscriberData = await subscriberRes.json();
        log('RC subscriber fetch', { status: subscriberRes.status });

        // Step 2: Try RC v2 web billing checkout creation
        // RC project ID — required for v2 API
        const rcProjectId = Deno.env.get('REVENUECAT_PROJECT_ID') || '';

        if (rcProjectId) {
          const checkoutRes = await fetch(
            `https://api.revenuecat.com/v2/projects/${encodeURIComponent(rcProjectId)}/billing/checkout_sessions`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${rcSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                app_user_id: user.id,
                product_id: productId,
                success_url: 'dawinixht://subscription/success',
                cancel_url: 'dawinixht://subscription/cancel',
                customer_email: user.email,
              }),
            },
          );

          if (checkoutRes.ok) {
            const checkoutData = await checkoutRes.json();
            const url = checkoutData?.url || checkoutData?.checkout_url;
            if (url) {
              log('RC web billing checkout created', { url });
              return new Response(
                JSON.stringify({ url, provider: 'revenuecat', productId }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
          } else {
            const errBody = await checkoutRes.text();
            log('RC v2 checkout failed', { status: checkoutRes.status, body: errBody });
          }
        }

        // Step 3: Try RC web billing hosted paywall URL (simpler alternative)
        // RC exposes a hosted paywall at a known URL pattern when Web Billing is enabled
        const rcAppId = Deno.env.get('REVENUECAT_APP_ID') || '';
        if (rcAppId) {
          // Build offering identifier from plan
          const offeringId = plan === 'plus' ? 'plus' : 'go';
          const hostedUrl = `https://billing.revenuecat.com/subscribe?app_id=${encodeURIComponent(rcAppId)}&app_user_id=${encodeURIComponent(user.id)}&offering=${encodeURIComponent(offeringId)}&product=${encodeURIComponent(productId)}`;
          log('RC hosted paywall URL', { hostedUrl });
          return new Response(
            JSON.stringify({ url: hostedUrl, provider: 'revenuecat_hosted', productId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Step 4: Fallback — RC web billing entitlement redirect
        // If project/app IDs not configured, redirect to RC subscriber management
        const entitlement = plan === 'plus' ? 'plus' : 'go';
        const rcFallbackUrl = `https://app.revenuecat.com/billing/subscribe?app_user_id=${encodeURIComponent(user.id)}&entitlement_id=${entitlement}&email=${encodeURIComponent(user.email || '')}`;
        log('RC fallback URL');
        return new Response(
          JSON.stringify({ url: rcFallbackUrl, provider: 'revenuecat_fallback', productId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );

      } catch (rcErr: any) {
        log('RC API error, falling back to Stripe', { msg: rcErr?.message });
      }
    }

    // ── Stripe fallback checkout ───────────────────────────────────────────
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Payment provider not configured. Please set REVENUECAT_SECRET_KEY or STRIPE_SECRET_KEY.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    log('Falling back to Stripe hosted checkout');
    const priceId = STRIPE_PRICE_MAP[plan] || STRIPE_PRICE_MAP['plus'];

    // Find or create Stripe customer
    let customerId: string | undefined;
    try {
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email || '')}&limit=1`,
        { headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Version': '2025-03-31.basil' } },
      );
      const customerData = await customerRes.json();
      if (customerData?.data?.length > 0) {
        customerId = customerData.data[0].id;
      } else {
        const createRes = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Stripe-Version': '2025-03-31.basil',
          },
          body: new URLSearchParams({
            email: user.email || '',
            'metadata[user_id]': user.id,
            'metadata[plan]': plan,
          }).toString(),
        });
        const newCustomer = await createRes.json();
        customerId = newCustomer?.id;
      }
    } catch { /* non-fatal */ }

    const params = new URLSearchParams({
      mode: 'subscription',
      'payment_method_types[0]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: 'dawinixht://subscription/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'dawinixht://subscription/cancel',
      'client_reference_id': user.id,
      'metadata[user_id]': user.id,
      'metadata[plan]': plan,
      billing_address_collection: 'auto',
    });
    if (customerId) params.set('customer', customerId);
    else params.set('customer_email', user.email || '');

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2025-03-31.basil',
      },
      body: params.toString(),
    });
    const sessionData = await sessionRes.json();
    if (!sessionRes.ok) {
      throw new Error(`Stripe: ${sessionData?.error?.message || JSON.stringify(sessionData)}`);
    }

    log('Stripe checkout session created', { sessionId: sessionData.id });
    return new Response(
      JSON.stringify({ url: sessionData.url, provider: 'stripe', sessionId: sessionData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    log('Unhandled error', { message: err?.message });
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
