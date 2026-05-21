import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform, receipt, transactionId } = await req.json();

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

    let verificationResult: any;

    if (platform === 'ios') {
      // Verify Apple In-App Purchase
      verificationResult = await verifyApplePurchase(receipt);
    } else if (platform === 'android') {
      // Verify Google Play Purchase
      verificationResult = await verifyGooglePurchase(receipt, transactionId);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verificationResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid purchase', details: verificationResult.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate platform fees (Apple: 30%, Google: 30%)
    const platformFeeRate = 0.30;
    const grossAmount = verificationResult.amount;
    const platformFee = grossAmount * platformFeeRate;
    const netAmount = grossAmount - platformFee;

    // Save purchase to database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('subscription_purchases')
      .insert({
        user_id: user.id,
        plan_id: verificationResult.productId,
        platform,
        transaction_id: verificationResult.transactionId,
        original_transaction_id: verificationResult.originalTransactionId,
        receipt_data: receipt,
        purchase_date: verificationResult.purchaseDate,
        expiry_date: verificationResult.expiryDate,
        is_trial: verificationResult.isTrial || false,
        auto_renewing: verificationResult.autoRenewing || true,
        status: 'active',
        gross_amount: grossAmount,
        platform_fee: platformFee,
        net_amount: netAmount,
        currency: verificationResult.currency || 'USD',
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Purchase save error:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'Failed to save purchase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user subscription tier
    const subscriptionTier = verificationResult.productId.includes('yearly') ? 'premium_yearly' : 'premium_monthly';
    await supabaseAdmin
      .from('user_profiles')
      .update({
        subscription_tier: subscriptionTier,
        subscription_expires_at: verificationResult.expiryDate,
      })
      .eq('id', user.id);

    // Update revenue reports
    await updateRevenueReports(supabaseAdmin, {
      date: new Date().toISOString().split('T')[0],
      grossAmount,
      platformFee,
      netAmount,
      platform,
    });

    return new Response(
      JSON.stringify({
        success: true,
        purchase,
        subscription: {
          tier: subscriptionTier,
          expiresAt: verificationResult.expiryDate,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function verifyApplePurchase(receipt: string): Promise<any> {
  // Apple Receipt Validation
  // Production: https://buy.itunes.apple.com/verifyReceipt
  // Sandbox: https://sandbox.itunes.apple.com/verifyReceipt
  
  const endpoint = Deno.env.get('APPLE_RECEIPT_VALIDATION_ENDPOINT') || 'https://sandbox.itunes.apple.com/verifyReceipt';
  const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET') || '';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receipt,
        'password': sharedSecret,
        'exclude-old-transactions': true,
      }),
    });

    const data = await response.json();

    if (data.status !== 0) {
      return { valid: false, error: `Apple validation failed: ${data.status}` };
    }

    const latestReceipt = data.latest_receipt_info?.[0] || data.receipt?.in_app?.[0];
    if (!latestReceipt) {
      return { valid: false, error: 'No receipt information found' };
    }

    return {
      valid: true,
      productId: latestReceipt.product_id,
      transactionId: latestReceipt.transaction_id,
      originalTransactionId: latestReceipt.original_transaction_id,
      purchaseDate: new Date(parseInt(latestReceipt.purchase_date_ms)),
      expiryDate: new Date(parseInt(latestReceipt.expires_date_ms)),
      amount: parseFloat(latestReceipt.price || '0'),
      currency: latestReceipt.currency || 'USD',
      isTrial: latestReceipt.is_trial_period === 'true',
      autoRenewing: data.auto_renew_status === 1,
    };
  } catch (error) {
    return { valid: false, error: `Apple verification failed: ${error.message}` };
  }
}

async function verifyGooglePurchase(receipt: string, transactionId: string): Promise<any> {
  // Google Play Purchase Verification
  // Requires Google Play Developer API access
  
  const packageName = Deno.env.get('GOOGLE_PACKAGE_NAME') || '';
  const serviceAccountEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') || '';
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '';

  try {
    // Get OAuth token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: await createJWT(serviceAccountEmail, serviceAccountKey),
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Verify purchase
    const purchaseData = JSON.parse(receipt);
    const productId = purchaseData.productId;
    const purchaseToken = purchaseData.purchaseToken;

    const verifyResponse = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (verifyData.error) {
      return { valid: false, error: `Google verification failed: ${verifyData.error.message}` };
    }

    return {
      valid: true,
      productId: productId,
      transactionId: purchaseData.orderId || transactionId,
      originalTransactionId: purchaseData.orderId || transactionId,
      purchaseDate: new Date(parseInt(verifyData.startTimeMillis)),
      expiryDate: new Date(parseInt(verifyData.expiryTimeMillis)),
      amount: parseFloat(verifyData.priceAmountMicros || '0') / 1000000,
      currency: verifyData.priceCurrencyCode || 'USD',
      isTrial: verifyData.paymentState === 2,
      autoRenewing: verifyData.autoRenewing || false,
    };
  } catch (error) {
    return { valid: false, error: `Google verification failed: ${error.message}` };
  }
}

async function createJWT(email: string, privateKey: string): Promise<string> {
  // Create JWT for Google Service Account (simplified)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  
  // In production, use proper RS256 signing with private key
  // This is a placeholder - real implementation requires crypto library
  return `${header}.${payload}.signature`;
}

async function updateRevenueReports(supabase: any, data: any) {
  const { date, grossAmount, platformFee, netAmount, platform } = data;

  const { data: existing } = await supabase
    .from('revenue_reports')
    .select('*')
    .eq('report_date', date)
    .single();

  if (existing) {
    await supabase
      .from('revenue_reports')
      .update({
        total_revenue: existing.total_revenue + grossAmount,
        platform_fees: existing.platform_fees + platformFee,
        net_revenue: existing.net_revenue + netAmount,
        new_subscriptions: existing.new_subscriptions + 1,
        ios_revenue: platform === 'ios' ? existing.ios_revenue + grossAmount : existing.ios_revenue,
        android_revenue: platform === 'android' ? existing.android_revenue + grossAmount : existing.android_revenue,
      })
      .eq('report_date', date);
  } else {
    await supabase
      .from('revenue_reports')
      .insert({
        report_date: date,
        total_revenue: grossAmount,
        platform_fees: platformFee,
        net_revenue: netAmount,
        new_subscriptions: 1,
        ios_revenue: platform === 'ios' ? grossAmount : 0,
        android_revenue: platform === 'android' ? grossAmount : 0,
      });
  }
}
