import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Map Stripe product IDs → plan names used in the app
const PRODUCT_PLAN_MAP: Record<string, string> = {
  'prod_ThBGbK8D1tAh0w': 'plus',  // Premium Yearly product
  'prod_UOHQvMBEjUgzfG': 'plus',  // Premium Monthly product
  'prod_ThBG24kiMMlK4f': 'plus',  // Lifetime Access
  'prod_TedMqtvOncuFAL': 'go',    // Pro / Go plan
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` — ${JSON.stringify(details)}` : '';
  console.log(`[check-subscription] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  try {
    logStep('Function started');

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header missing');

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.email) throw new Error('Unauthorized');
    const user = userData.user;
    logStep('User authenticated', { userId: user.id, email: user.email });

    // ── Find Stripe customer by email ──
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email!)}&limit=1`,
      { headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Version': '2025-03-31.basil' } },
    );
    const searchData = await searchRes.json();

    if (!searchData?.data?.length) {
      logStep('No Stripe customer found');
      // Sync user_profiles back to free
      try {
        await supabaseAdmin.from('user_profiles').update({
          subscription_tier: 'free',
          subscription_expires_at: null,
        }).eq('id', user.id);
      } catch (_e) {}
      return new Response(
        JSON.stringify({ subscribed: false, plan: null, subscription_end: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const customerId = searchData.data[0].id;
    logStep('Stripe customer found', { customerId });

    // ── List active subscriptions ──
    const subsRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=5&expand[]=data.items.data.price.product`,
      { headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Version': '2025-03-31.basil' } },
    );
    const subsData = await subsRes.json();
    const activeSubs = subsData?.data || [];
    const hasActiveSub = activeSubs.length > 0;

    let plan: string | null = null;
    let subscriptionEnd: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (hasActiveSub) {
      const sub = activeSubs[0];
      stripeSubscriptionId = sub.id;
      subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();

      // Determine plan from product ID
      const productId = sub.items?.data?.[0]?.price?.product?.id
        ?? sub.items?.data?.[0]?.price?.product
        ?? '';
      plan = PRODUCT_PLAN_MAP[productId] || 'plus';
      logStep('Active subscription', { subId: sub.id, productId, plan, subscriptionEnd });

      // ── Update subscription_purchases table (use try-catch, not .catch()) ──
      try {
        await supabaseAdmin.from('subscription_purchases').upsert({
          user_id: user.id,
          plan_id: plan,
          platform: 'stripe',
          transaction_id: sub.id,
          original_transaction_id: sub.id,
          purchase_date: new Date(sub.created * 1000).toISOString(),
          expiry_date: subscriptionEnd,
          status: 'active',
          auto_renewing: !sub.cancel_at_period_end,
          gross_amount: (sub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100,
          platform_fee: 0,
          net_amount: (sub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100,
          currency: sub.currency?.toUpperCase() ?? 'USD',
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubscriptionId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'transaction_id' });
      } catch (_e) {}

      // ── Sync user_profiles.subscription_tier ──
      try {
        await supabaseAdmin.from('user_profiles').update({
          subscription_tier: plan,
          subscription_expires_at: subscriptionEnd,
        }).eq('id', user.id);
      } catch (_e) {}

    } else {
      logStep('No active subscription');
      // Sync user_profiles back to free if expired
      try {
        await supabaseAdmin.from('user_profiles').update({
          subscription_tier: 'free',
          subscription_expires_at: null,
        }).eq('id', user.id);
      } catch (_e) {}
    }

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        plan,
        subscription_end: subscriptionEnd,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscriptionId,
      }),
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
