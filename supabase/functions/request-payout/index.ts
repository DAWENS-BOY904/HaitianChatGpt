import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, payoutMethodId } = await req.json();

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate available balance
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: revenueData } = await supabaseAdmin
      .from('revenue_reports')
      .select('net_revenue');

    const totalRevenue = revenueData?.reduce((sum, r) => sum + parseFloat(r.net_revenue || '0'), 0) || 0;

    const { data: payoutData } = await supabaseAdmin
      .from('payouts')
      .select('amount')
      .in('status', ['completed', 'processing']);

    const totalPayouts = payoutData?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
    const availableBalance = totalRevenue - totalPayouts;

    if (amount > availableBalance) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          availableBalance,
          requestedAmount: amount,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create payout request
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('payouts')
      .insert({
        admin_id: user.id,
        payout_method_id: payoutMethodId,
        amount,
        status: 'pending',
      })
      .select()
      .single();

    if (payoutError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create payout request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // In production, trigger actual payout processing here
    // e.g., Stripe, PayPal, bank transfer API

    return new Response(
      JSON.stringify({
        success: true,
        payout,
        message: 'Payout request created successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payout request error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
