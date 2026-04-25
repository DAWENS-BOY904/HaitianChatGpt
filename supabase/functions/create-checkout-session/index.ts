import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ── Real Stripe price IDs (monthly recurring subscriptions) ──
const PRICE_MAP: Record<string, string> = {
  go:   'price_1SjmtpE0VkO7z1Vn1lpvP0PC', // $8/month – Go plan
  plus: 'price_1TPUrzE0VkO7z1Vnlgj45978', // $19.99/month – Plus plan
};

// ── MonCash Sandbox Config ──
const MONCASH_SANDBOX_API = 'https://sandbox.moncashbutton.digicelgroup.com/Api';
const MONCASH_SANDBOX_GATEWAY = 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect';

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

    const { plan, priceId: rawPriceId, mode, amount, orderId } = body;
    const isPaymentSheet = mode === 'payment_sheet';
    const isMonCash = mode === 'moncash';
    logStep('Request received', { plan, rawPriceId, mode, isMonCash });

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

    // ══════════════════════════════════════════════════════════
    // MODE C: MonCash (Haiti only)
    // ══════════════════════════════════════════════════════════
    if (isMonCash) {
      logStep('MonCash mode — creating payment token');

      const moncashClientId = Deno.env.get('MONCASH_SANDBOX_CLIENT_ID');
      const moncashSecret = Deno.env.get('MONCASH_SANDBOX_SECRET');

      if (!moncashClientId || !moncashSecret) {
        return new Response(
          JSON.stringify({ error: 'MonCash not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // 1. Get OAuth token from MonCash
      const authRes = await fetch(`${MONCASH_SANDBOX_API}/oauth/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'read,write',
        }).toString(),
      });

      // MonCash uses Basic auth with client_id:secret in the URL or header
      const authWithBasic = await fetch(`${MONCASH_SANDBOX_API}/oauth/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Basic ' + btoa(`${moncashClientId}:${moncashSecret}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'read,write',
        }).toString(),
      });

      const authData = await authWithBasic.json();
      if (!authWithBasic.ok || !authData.access_token) {
        logStep('MonCash auth failed', authData);
        return new Response(
          JSON.stringify({ error: 'MonCash authentication failed', details: authData }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const accessToken = authData.access_token;
      logStep('MonCash auth success');

      // 2. Create payment
      const moncashOrderId = orderId || `DWNX-${user.id}-${Date.now()}`;
      const paymentBody = {
        amount: amount || (plan === 'plus' ? 2650 : 1060),
        orderId: moncashOrderId,
      };

      const createRes = await fetch(`${MONCASH_SANDBOX_API}/v1/CreatePayment`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentBody),
      });

      const paymentData = await createRes.json();
      if (!createRes.ok || !paymentData.payment_token?.token) {
        logStep('MonCash payment creation failed', paymentData);
        return new Response(
          JSON.stringify({ error: 'MonCash payment creation failed', details: paymentData }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const paymentToken = paymentData.payment_token.token;
      const paymentUrl = `${MONCASH_SANDBOX_GATEWAY}?token=${paymentToken}`;
      logStep('MonCash payment token created', { orderId: moncashOrderId });

      // 3. Store pending transaction in DB for later verification
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      try {
        await supabaseAdmin.from('moncash_transactions').insert({
          user_id: user.id,
          order_id: moncashOrderId,
          plan: plan || 'plus',
          amount: paymentBody.amount,
          currency: 'HTG',
          status: 'pending',
          token: paymentToken,
          created_at: new Date().toISOString(),
        });
      } catch (_e) {}

      return new Response(
        JSON.stringify({
          paymentUrl,
          orderId: moncashOrderId,
          token: paymentToken,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Stripe key ──
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve price ID ──
    let resolvedPriceId: string = '';
    if (rawPriceId && String(rawPriceId).startsWith('price_')) {
      resolvedPriceId = rawPriceId;
    } else if (plan && PRICE_MAP[plan]) {
      resolvedPriceId = PRICE_MAP[plan];
    } else {
      resolvedPriceId = PRICE_MAP['plus'];
    }
    logStep('Resolved price', { resolvedPriceId });

    // ── User email ──
    let userEmail = user.email || '';
    try {
      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('email')
        .eq('id', user.id)
        .single();
      if (profile?.email) userEmail = profile.email;
    } catch (_e) {}

    // ── Find or create Stripe customer ──
    let customerId: string | undefined;
    try {
      const customerSearchRes = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(userEmail)}&limit=1`,
        { headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Version': '2025-03-31.basil' } },
      );
      const customerSearchData = await customerSearchRes.json();
      if (customerSearchData?.data?.length > 0) {
        customerId = customerSearchData.data[0].id;
        logStep('Existing Stripe customer found', { customerId });
      } else {
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
    } catch (customerErr: any) {
      logStep('Customer lookup error (non-fatal)', { msg: customerErr?.message });
    }

    // ── Store customer ID on user profile ──
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    try {
      await supabaseAdmin
        .from('user_profiles')
        .update({ billing_info: { stripe_customer_id: customerId } } as any)
        .eq('id', user.id);
    } catch (_e) {}

    // ══════════════════════════════════════════════════════════
    // MODE A: payment_sheet — return SetupIntent / SubscriptionIntent
    // client_secret so @stripe/stripe-react-native can present in-app
    // ══════════════════════════════════════════════════════════
    if (isPaymentSheet) {
      logStep('PaymentSheet mode — creating Stripe Subscription + SetupIntent');

      // Create an ephemeral key for the customer (required by PaymentSheet)
      let ephemeralKey: string | undefined;
      if (customerId) {
        try {
          const ekRes = await fetch('https://api.stripe.com/v1/ephemeral_keys', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${stripeKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Stripe-Version': '2024-06-20',
            },
            body: new URLSearchParams({ customer: customerId }).toString(),
          });
          const ekData = await ekRes.json();
          ephemeralKey = ekData?.secret;
          logStep('Ephemeral key created');
        } catch (_e) {}
      }

      // Create subscription with payment_behavior=default_incomplete to get a PaymentIntent
      const subParams = new URLSearchParams({
        customer: customerId || '',
        'items[0][price]': resolvedPriceId,
        payment_behavior: 'default_incomplete',
        'expand[0]': 'latest_invoice.payment_intent',
        'metadata[user_id]': user.id,
        'metadata[plan]': plan || 'plus',
      });
      // Apply DAWINIX2026 coupon
      subParams.set('coupon', 'ivUqadLE');

      const subRes = await fetch('https://api.stripe.com/v1/subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2025-03-31.basil',
        },
        body: subParams.toString(),
      });
      const subData = await subRes.json();

      if (!subRes.ok) {
        const errMsg = subData?.error?.message || JSON.stringify(subData);
        logStep('Stripe subscription error', { status: subRes.status, errMsg });
        // Fall back to hosted checkout
        logStep('Falling back to hosted checkout');
      } else {
        const clientSecret = subData?.latest_invoice?.payment_intent?.client_secret;
        if (clientSecret) {
          logStep('PaymentIntent clientSecret obtained', { subId: subData.id });
          return new Response(
            JSON.stringify({
              clientSecret,
              customerId,
              ephemeralKey,
              subscriptionId: subData.id,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      // If subscription creation fails or no clientSecret, fall through to hosted checkout
      logStep('No clientSecret from subscription — falling back to hosted checkout URL');
    }

    // ══════════════════════════════════════════════════════════
    // MODE B: hosted Stripe Checkout (default / fallback)
    // ══════════════════════════════════════════════════════════
    logStep('Hosted checkout mode');
    const params = new URLSearchParams({
      mode: 'subscription',
      'payment_method_types[0]': 'card',
      'line_items[0][price]': resolvedPriceId,
      'line_items[0][quantity]': '1',
      success_url: 'dawinixht://subscription/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  'dawinixht://subscription/cancel',
      'client_reference_id': user.id,
      'metadata[user_id]': user.id,
      'metadata[plan]': plan || resolvedPriceId,
      'discounts[0][coupon]': 'ivUqadLE',
      billing_address_collection: 'auto',
    });

    if (customerId) {
      params.set('customer', customerId);
    } else {
      params.set('customer_email', userEmail);
    }

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

    // Log activity
    try {
      await supabaseAdmin.from('activity_logs').insert({
        user_id: user.id,
        action: 'checkout_session_created',
        action_type: 'payment',
        details: { sessionId: stripeData.id, plan: plan || resolvedPriceId, customerId },
      });
    } catch (_e) {}

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
