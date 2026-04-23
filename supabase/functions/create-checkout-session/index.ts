import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { priceId, plan } = body;

    if (!priceId && !plan) {
      return new Response(
        JSON.stringify({ error: 'priceId or plan is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Stripe secret key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured. Please contact support.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve priceId from plan name if not provided directly
    let resolvedPriceId = priceId;
    if (!resolvedPriceId && plan) {
      // Look up price from subscription_plans table
      const { data: planData } = await supabaseClient
        .from('subscription_plans')
        .select('plan_id')
        .eq('plan_id', plan)
        .single();

      if (!planData) {
        // Fallback: derive from plan name
        // Admin should configure actual Stripe price IDs in the DB
        resolvedPriceId = plan; // use plan string as price ID fallback
      } else {
        resolvedPriceId = planData.plan_id;
      }
    }

    if (!resolvedPriceId) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve a valid Stripe price ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user email from profile
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    const userEmail = profile?.email || user.email || '';

    // Deep-link URLs so the app can handle success/cancel
    const successUrl = 'https://dawinix.com/subscription?success=true&session_id={CHECKOUT_SESSION_ID}';
    const cancelUrl = 'https://dawinix.com/subscription?canceled=true';

    // Build Stripe checkout session params
    // FIX: Only use supported payment_method_types; apple_pay is handled automatically by Stripe
    const params = new URLSearchParams({
      'mode': 'subscription',
      'payment_method_types[0]': 'card',
      'line_items[0][price]': resolvedPriceId,
      'line_items[0][quantity]': '1',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'client_reference_id': user.id,
      'metadata[user_id]': user.id,
      'metadata[plan]': plan || resolvedPriceId,
    });

    // Add customer email if available
    if (userEmail) {
      params.set('customer_email', userEmail);
    }

    // Allow promotion codes
    params.set('allow_promotion_codes', 'true');

    // Create Stripe Checkout Session
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2025-03-31.basil',
      },
      body: params.toString(),
    });

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      const stripeError = stripeData?.error?.message || JSON.stringify(stripeData);
      console.error('Stripe API error:', stripeResponse.status, stripeError);
      return new Response(
        JSON.stringify({ error: `Stripe: ${stripeError}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checkout session created: ${stripeData.id} for user ${user.id}`);

    // Log to activity_logs (non-blocking)
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabaseAdmin.from('activity_logs').insert({
        user_id: user.id,
        action: 'checkout_session_created',
        action_type: 'payment',
        details: { sessionId: stripeData.id, plan: plan || resolvedPriceId },
      }).catch(() => {});
    } catch (_e) {}

    return new Response(
      JSON.stringify({
        url: stripeData.url,
        sessionId: stripeData.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unhandled checkout session error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
