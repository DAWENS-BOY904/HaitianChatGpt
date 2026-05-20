import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ── RevenueCat entitlement → plan name ───────────────────────────────────
const RC_ENTITLEMENT_MAP: Record<string, string> = {
  'plus': 'plus',
  'go': 'go',
  'premium': 'plus',
  'pro': 'go',
};

// Map Stripe product IDs → plan names used in the app
const PRODUCT_PLAN_MAP: Record<string, string> = {
  'prod_ThBGbK8D1tAh0w': 'plus',
  'prod_UOHQvMBEjUgzfG': 'plus',
  'prod_ThBG24kiMMlK4f': 'plus',
  'prod_TedMqtvOncuFAL': 'go',
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

    // ── Authenticate user first (required for all paths) ─────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header missing');

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) throw new Error('Unauthorized');

    const user = userData.user;
    logStep('User authenticated', { userId: user.id, email: user.email });

    // ── Check RevenueCat entitlements (now user is defined) ───────────────
    const rcSecretKey = Deno.env.get('REVENUECAT_SECRET_KEY')
      || Deno.env.get('REVENUECAT_IOS_KEY')
      || '';

    if (rcSecretKey) {
      try {
        const rcRes = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
          {
            headers: {
              'Authorization': `Bearer ${rcSecretKey}`,
              'Content-Type': 'application/json',
              'X-Platform': 'web',
            },
          },
        );
        if (rcRes.ok) {
          const rcData = await rcRes.json();
          const entitlements: Record<string, any> = rcData?.subscriber?.entitlements || {};
          const activeEntitlement = Object.entries(entitlements).find(
            ([, v]) => v?.expires_date === null || new Date(v?.expires_date) > new Date(),
          );
          if (activeEntitlement) {
            const [entitlementId, entitlementData] = activeEntitlement;
            const rcPlan = RC_ENTITLEMENT_MAP[entitlementId.toLowerCase()] || 'plus';
            const rcExpiry = entitlementData?.expires_date || null;
            logStep('RC active entitlement found', { entitlementId, rcPlan, rcExpiry });

            // Sync to user_profiles
            try {
              await supabaseAdmin.from('user_profiles').update({
                subscription_tier: rcPlan,
                subscription_expires_at: rcExpiry,
              }).eq('id', user.id);
            } catch (_e) {}

            return new Response(
              JSON.stringify({
                subscribed: true,
                plan: rcPlan,
                subscription_end: rcExpiry,
                provider: 'revenuecat',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
          logStep('RC subscriber exists but no active entitlements');
        }
      } catch (rcErr: any) {
        logStep('RC check error (non-fatal)', { msg: rcErr?.message });
      }
    }

    // ── Check Stripe subscriptions ────────────────────────────────────────
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey || !user.email) {
      // No Stripe configured or no email — return free
      return new Response(
        JSON.stringify({ subscribed: false, plan: null, subscription_end: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Find Stripe customer by email ──
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
      { headers: { Authorization: `Bearer ${stripeKey}`, 'Stripe-Version': '2025-03-31.basil' } },
    );
    const searchData = await searchRes.json();

    if (!searchData?.data?.length) {
      logStep('No Stripe customer found');
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

      const productId = sub.items?.data?.[0]?.price?.product?.id
        ?? sub.items?.data?.[0]?.price?.product
        ?? '';
      plan = PRODUCT_PLAN_MAP[productId] || 'plus';
      logStep('Active subscription', { subId: sub.id, productId, plan, subscriptionEnd });

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

      try {
        await supabaseAdmin.from('user_profiles').update({
          subscription_tier: plan,
          subscription_expires_at: subscriptionEnd,
        }).eq('id', user.id);
      } catch (_e) {}

    } else {
      logStep('No active subscription');
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
