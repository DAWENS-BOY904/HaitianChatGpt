import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set');

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    // Webhook secret (optional but recommended)
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error('[webhook] Signature verification failed:', err.message);
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Allow unsigned in dev
      event = JSON.parse(body) as Stripe.Event;
    }

    console.log('[webhook] Received event:', event.type);

    // ── Handle subscription cancelled / expired ──
    if (
      event.type === 'customer.subscription.deleted' ||
      event.type === 'customer.subscription.updated'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const status = subscription.status;

      console.log(`[webhook] Subscription ${subscription.id} status: ${status} for customer ${customerId}`);

      // Only revoke access on fully cancelled or past_due/unpaid
      const shouldRevoke =
        event.type === 'customer.subscription.deleted' ||
        status === 'canceled' ||
        status === 'unpaid';

      if (shouldRevoke) {
        // Find user by stripe_customer_id in subscription_purchases
        const { data: purchase } = await supabase
          .from('subscription_purchases')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (purchase?.user_id) {
          await supabase
            .from('user_profiles')
            .update({
              subscription_tier: 'free',
              subscription_expires_at: null,
            })
            .eq('id', purchase.user_id);

          // Also mark the purchase as cancelled
          await supabase
            .from('subscription_purchases')
            .update({ status: 'cancelled', auto_renewing: false })
            .eq('stripe_customer_id', customerId)
            .eq('status', 'active');

          console.log(`[webhook] Revoked subscription for user ${purchase.user_id}`);
        } else {
          console.warn(`[webhook] No user found for customer ${customerId}`);
        }
      }
    }

    // ── Handle payment failures ──
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      console.log(`[webhook] Payment failed for customer ${customerId}`);

      const { data: purchase } = await supabase
        .from('subscription_purchases')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();

      if (purchase?.user_id) {
        // Optionally downgrade immediately or leave for subscription.deleted
        // For now: just log — the subscription.deleted event will fire if retry fails
        console.log(`[webhook] Payment failed for user ${purchase.user_id} — waiting for retry`);
      }
    }

    // ── Handle successful checkout ──
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (customerId && subscriptionId) {
        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

        // Find user
        const { data: purchase } = await supabase
          .from('subscription_purchases')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (purchase?.user_id) {
          await supabase
            .from('user_profiles')
            .update({
              subscription_tier: 'plus',
              subscription_expires_at: expiresAt,
            })
            .eq('id', purchase.user_id);

          console.log(`[webhook] Activated subscription for user ${purchase.user_id} until ${expiresAt}`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[webhook] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
