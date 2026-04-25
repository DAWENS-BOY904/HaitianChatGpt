import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MONCASH_SANDBOX_API = 'https://sandbox.moncashbutton.digicelgroup.com/Api';

const logStep = (step: string, details?: any) => {
  const d = details ? ` — ${JSON.stringify(details)}` : '';
  console.log(`[verify-moncash-payment] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Get MonCash credentials ──
    const moncashClientId = Deno.env.get('MONCASH_SANDBOX_CLIENT_ID');
    const moncashSecret = Deno.env.get('MONCASH_SANDBOX_SECRET');

    if (!moncashClientId || !moncashSecret) {
      return new Response(
        JSON.stringify({ error: 'MonCash not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Get OAuth token ──
    const authRes = await fetch(`${MONCASH_SANDBOX_API}/oauth/token`, {
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

    const authData = await authRes.json();
    if (!authRes.ok || !authData.access_token) {
      return new Response(
        JSON.stringify({ error: 'MonCash auth failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accessToken = authData.access_token;

    // ── Retrieve payment by Order ID ──
    const retrieveRes = await fetch(`${MONCASH_SANDBOX_API}/v1/RetrieveOrderPayment`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    });

    const paymentData = await retrieveRes.json();
    logStep('Payment retrieved', { orderId, status: paymentData.status });

    // Check if payment was successful
    const isSuccess = paymentData.status === 200 && 
                      paymentData.payment?.message === 'successful';

    // Update transaction record
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    try {
      await supabaseAdmin
        .from('moncash_transactions')
        .update({
          status: isSuccess ? 'completed' : 'failed',
          payment_details: paymentData.payment,
          verified_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);
    } catch (_e) {}

    if (isSuccess) {
      // Calculate subscription end (1 month from now)
      const subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

      return new Response(
        JSON.stringify({
          status: 'success',
          payment: paymentData.payment,
          subscription_end: subscriptionEnd.toISOString(),
          billingInfo: {
            provider: 'moncash',
            transaction_id: paymentData.payment?.transaction_id,
            payer: paymentData.payment?.payer,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } else {
      return new Response(
        JSON.stringify({
          status: 'pending_or_failed',
          payment: paymentData.payment,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

  } catch (error: any) {
    logStep('Unhandled error', { message: error?.message });
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
