import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ============================================
// KONFIGIRASYON
// ============================================

const CONFIG = {
  // API Keys
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  
  // Apple
  APPLE_SHARED_SECRET: Deno.env.get('APPLE_SHARED_SECRET'),
  APPLE_BUNDLE_ID: Deno.env.get('APPLE_BUNDLE_ID'),
  
  // Google
  GOOGLE_PACKAGE_NAME: Deno.env.get('GOOGLE_PACKAGE_NAME'),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
  GOOGLE_SERVICE_ACCOUNT_KEY: Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY'),
  
  // Pricing
  PLATFORM_FEE_RATE: 0.30, // 30% Apple/Google
  SMALL_BUSINESS_RATE: 0.15, // 15% for small business (under $1M)
  
  // Validation
  MAX_RECEIPT_SIZE: 10000, // 10KB
  REQUEST_TIMEOUT_MS: 30000,
};

// ============================================
// TIP KI DEFINI
// ============================================

interface PurchaseRequest {
  platform: 'ios' | 'android';
  receipt: string;
  transactionId?: string;
  productId?: string;
  isSandbox?: boolean;
}

interface AppleReceiptResponse {
  status: number;
  environment?: 'Sandbox' | 'Production';
  receipt?: {
    bundle_id?: string;
    in_app?: AppleInAppPurchase[];
  };
  latest_receipt_info?: AppleLatestReceipt[];
  pending_renewal_info?: any[];
}

interface AppleInAppPurchase {
  product_id: string;
  transaction_id: string;
  original_transaction_id: string;
  purchase_date_ms: string;
  expires_date_ms?: string;
  is_trial_period: string;
  quantity: string;
  price?: string;
  currency?: string;
}

interface AppleLatestReceipt {
  product_id: string;
  transaction_id: string;
  original_transaction_id: string;
  purchase_date_ms: string;
  expires_date_ms: string;
  is_trial_period: string;
  auto_renew_status?: string;
  price?: string;
  currency?: string;
}

interface GooglePurchaseResponse {
  kind: string;
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoRenewing: boolean;
  priceCurrencyCode: string;
  priceAmountMicros: string;
  paymentState?: number; // 0: pending, 1: received, 2: free trial, 3: pending deferred
  acknowledgementState?: number;
  cancelReason?: number;
  countryCode?: string;
}

interface VerificationResult {
  valid: boolean;
  error?: string;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  purchaseDate: Date;
  expiryDate: Date;
  amount: number;
  currency: string;
  isTrial: boolean;
  autoRenewing: boolean;
  isSandbox?: boolean;
  receiptData?: any;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

function validateRequest(body: any): { valid: boolean; error?: string; data?: PurchaseRequest } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }
  
  const { platform, receipt, transactionId, productId, isSandbox } = body;
  
  // Validate platform
  if (!platform || !['ios', 'android'].includes(platform)) {
    return { valid: false, error: 'Platform must be "ios" or "android"' };
  }
  
  // Validate receipt
  if (!receipt) {
    return { valid: false, error: 'Receipt is required' };
  }
  
  if (typeof receipt !== 'string') {
    return { valid: false, error: 'Receipt must be a string' };
  }
  
  if (receipt.length > CONFIG.MAX_RECEIPT_SIZE) {
    return { valid: false, error: `Receipt too large (max ${CONFIG.MAX_RECEIPT_SIZE} chars)` };
  }
  
  // Validate transactionId for Android
  if (platform === 'android' && !transactionId) {
    return { valid: false, error: 'TransactionId is required for Android' };
  }
  
  return {
    valid: true,
    data: {
      platform,
      receipt,
      transactionId,
      productId,
      isSandbox: isSandbox || false
    }
  };
}

function validateToken(authHeader: string | null): { valid: boolean; token?: string; error?: string } {
  if (!authHeader) {
    return { valid: false, error: 'Authorization header required' };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization must be Bearer token' };
  }
  
  const token = authHeader.replace('Bearer ', '').trim();
  
  if (!token || token.length < 10) {
    return { valid: false, error: 'Invalid token format' };
  }
  
  return { valid: true, token };
}

// ============================================
// APPLE VERIFICATION (REYÈL)
// ============================================

async function verifyApplePurchase(receipt: string, isSandbox: boolean): Promise<VerificationResult> {
  console.log('🍎 Verifying Apple purchase...');
  
  // Determine endpoint
  const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
  const productionUrl = 'https://buy.itunes.apple.com/verifyReceipt';
  
  // Try sandbox first if indicated, otherwise production
  let endpoints = isSandbox 
    ? [sandboxUrl, productionUrl] 
    : [productionUrl, sandboxUrl];
  
  let lastError: string | null = null;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`  Trying ${endpoint.includes('sandbox') ? 'sandbox' : 'production'}...`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receipt,
          'password': CONFIG.APPLE_SHARED_SECRET || '',
          'exclude-old-transactions': false,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${await response.text()}`;
        continue;
      }
      
      const data: AppleReceiptResponse = await response.json();
      
      // Status codes: https://developer.apple.com/documentation/appstorereceipts/status
      switch (data.status) {
        case 0: // Success
          break;
        case 21000: // App store could not read
          return { valid: false, error: 'Invalid receipt data format', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
        case 21002: // Data malformed
          return { valid: false, error: 'Receipt data is malformed', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
        case 21003: // Receipt not authenticated
          return { valid: false, error: 'Receipt could not be authenticated', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
        case 21004: // Shared secret mismatch
          return { valid: false, error: 'Shared secret does not match', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
        case 21005: // Server unavailable
          lastError = 'Apple server temporarily unavailable';
          continue;
        case 21006: // Subscription expired (but we still get receipt info)
          // Continue processing - we want the expiry info
          break;
        case 21007: // Sandbox receipt sent to production
          if (!endpoint.includes('sandbox')) {
            console.log('  -> Sandbox receipt detected, retrying with sandbox...');
            continue;
          }
          return { valid: false, error: 'Invalid receipt environment', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
        case 21008: // Production receipt sent to sandbox
          if (endpoint.includes('sandbox')) {
            console.log('  -> Production receipt detected, retrying with production...');
            continue;
          }
          return { valid: false, error: 'Invalid receipt environment', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
        case 21010: // Authorization revoked
          return { valid: false, error: 'Receipt authorization was revoked', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
        default:
          return { valid: false, error: `Apple error code: ${data.status}`, productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
      }
      
      // Get latest receipt info (for subscriptions)
      let latestReceipt: AppleLatestReceipt | AppleInAppPurchase | undefined;
      
      if (data.latest_receipt_info && data.latest_receipt_info.length > 0) {
        // Sort by expires_date_ms descending to get most recent
        latestReceipt = data.latest_receipt_info.sort((a, b) => 
          parseInt(b.expires_date_ms) - parseInt(a.expires_date_ms)
        )[0];
      } else if (data.receipt?.in_app && data.receipt.in_app.length > 0) {
        // Fallback to receipt.in_app for one-time purchases
        latestReceipt = data.receipt.in_app.sort((a, b) => 
          parseInt(b.purchase_date_ms) - parseInt(a.purchase_date_ms)
        )[0];
      }
      
      if (!latestReceipt) {
        return { valid: false, error: 'No purchase information found in receipt', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
      }
      
      // Validate bundle ID
      const receiptBundleId = data.receipt?.bundle_id;
      if (receiptBundleId && CONFIG.APPLE_BUNDLE_ID && receiptBundleId !== CONFIG.APPLE_BUNDLE_ID) {
        return { valid: false, error: `Invalid bundle ID: ${receiptBundleId}`, productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
      }
      
      const isSubscription = 'expires_date_ms' in latestReceipt;
      const expiresMs = isSubscription 
        ? parseInt((latestReceipt as AppleLatestReceipt).expires_date_ms) 
        : null;
      
      return {
        valid: true,
        productId: latestReceipt.product_id,
        transactionId: latestReceipt.transaction_id,
        originalTransactionId: latestReceipt.original_transaction_id,
        purchaseDate: new Date(parseInt(latestReceipt.purchase_date_ms)),
        expiryDate: expiresMs ? new Date(expiresMs) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year for non-subscription
        amount: parseFloat(latestReceipt.price || '0') / 100, // Convert from cents
        currency: latestReceipt.currency || 'USD',
        isTrial: latestReceipt.is_trial_period === 'true',
        autoRenewing: (latestReceipt as AppleLatestReceipt).auto_renew_status === '1',
        isSandbox: data.environment === 'Sandbox',
        receiptData: data
      };
      
    } catch (error) {
      lastError = error.message;
      console.error(`  Error with ${endpoint}:`, error.message);
    }
  }
  
  return { 
    valid: false, 
    error: lastError || 'Failed to verify with Apple',
    productId: '',
    transactionId: '',
    originalTransactionId: '',
    purchaseDate: new Date(),
    expiryDate: new Date(),
    amount: 0,
    currency: 'USD',
    isTrial: false,
    autoRenewing: false
  };
}

// ============================================
// GOOGLE VERIFICATION (REYÒL)
// ============================================

// Cache for Google access tokens
let googleTokenCache: { token: string; expiresAt: number } | null = null;

async function getGoogleAccessToken(): Promise<string | null> {
  // Check cache
  if (googleTokenCache && googleTokenCache.expiresAt > Date.now() + 60000) {
    return googleTokenCache.token;
  }
  
  if (!CONFIG.GOOGLE_SERVICE_ACCOUNT_EMAIL || !CONFIG.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('Google service account not configured');
    return null;
  }
  
  try {
    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: CONFIG.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify(claim));
    
    // Note: Real RS256 signing requires crypto library
    // For Deno, use Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(`${header}.${payload}`);
    
    // Import private key
    const privateKey = CONFIG.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');
    const keyData = privateKey.replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    
    // For production, implement proper RSA signing
    // This is a simplified version - real implementation needs proper crypto
    
    // Alternative: Use Google Auth library if available
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${payload}.SIGNATURE_PLACEHOLDER`, // Replace with real signature
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('Google OAuth error:', tokenData.error);
      return null;
    }
    
    // Cache token
    googleTokenCache = {
      token: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000)
    };
    
    return tokenData.access_token;
    
  } catch (error) {
    console.error('Failed to get Google access token:', error);
    return null;
  }
}

async function verifyGooglePurchase(receipt: string, transactionId: string): Promise<VerificationResult> {
  console.log('🤖 Verifying Google purchase...');
  
  try {
    // Parse receipt
    let purchaseData: any;
    try {
      purchaseData = JSON.parse(receipt);
    } catch (e) {
      return { valid: false, error: 'Invalid receipt JSON', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
    }
    
    const { productId, purchaseToken, packageName } = purchaseData;
    
    if (!productId || !purchaseToken) {
      return { valid: false, error: 'Missing productId or purchaseToken in receipt', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
    }
    
    const pkg = packageName || CONFIG.GOOGLE_PACKAGE_NAME;
    if (!pkg) {
      return { valid: false, error: 'Package name not provided', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
    }
    
    // Get access token
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return { valid: false, error: 'Failed to authenticate with Google', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
    }
    
    // Determine if subscription or one-time purchase
    const isSubscription = productId.includes('sub') || productId.includes('premium');
    const apiVersion = 'v3';
    
    let url: string;
    if (isSubscription) {
      url = `https://androidpublisher.googleapis.com/androidpublisher/${apiVersion}/applications/${pkg}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    } else {
      url = `https://androidpublisher.googleapis.com/androidpublisher/${apiVersion}/applications/${pkg}/purchases/products/${productId}/tokens/${purchaseToken}`;
    }
    
    console.log(`  Calling Google API: ${isSubscription ? 'subscription' : 'product'}...`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API error:', response.status, errorText);
      
      if (response.status === 404) {
        return { valid: false, error: 'Purchase not found. Invalid product or token.', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
      }
      if (response.status === 401) {
        return { valid: false, error: 'Authentication failed with Google', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
      }
      
      return { valid: false, error: `Google API error: ${response.status}`, productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
    }
    
    const data: GooglePurchaseResponse = await response.json();
    
    // Check payment state
    const paymentState = data.paymentState;
    if (paymentState === 0) {
      return { valid: false, error: 'Payment still pending', productId: '', transactionId: '', originalTransactionId: '', purchaseDate: new Date(), expiryDate: new Date(), amount: 0, currency: 'USD', isTrial: false, autoRenewing: false };
    }
    
    // Check if cancelled
    if (data.cancelReason !== undefined && data.cancelReason !== null) {
      console.log('  Warning: Purchase was cancelled, reason:', data.cancelReason);
    }
    
    // For one-time purchases, check acknowledgement
    if (!isSubscription && data.acknowledgementState === 0) {
      console.log('  Note: Product not yet acknowledged');
    }
    
    const startTime = parseInt(data.startTimeMillis);
    const expiryTime = parseInt(data.expiryTimeMillis);
    
    return {
      valid: true,
      productId: productId,
      transactionId: transactionId || purchaseData.orderId,
      originalTransactionId: purchaseData.orderId || transactionId,
      purchaseDate: new Date(startTime),
      expiryDate: new Date(expiryTime),
      amount: parseFloat(data.priceAmountMicros) / 1000000,
      currency: data.priceCurrencyCode,
      isTrial: paymentState === 2, // 2 = Free trial
      autoRenewing: data.autoRenewing,
    };
    
  } catch (error) {
    console.error('Google verification error:', error);
    return { 
      valid: false, 
      error: `Verification failed: ${error.message}`,
      productId: '',
      transactionId: '',
      originalTransactionId: '',
      purchaseDate: new Date(),
      expiryDate: new Date(),
      amount: 0,
      currency: 'USD',
      isTrial: false,
      autoRenewing: false
    };
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

async function savePurchase(
  supabase: any,
  userId: string,
  verification: VerificationResult,
  platform: string,
  receipt: string
): Promise<{ success: boolean; purchase?: any; error?: string }> {
  try {
    // Calculate amounts
    const grossAmount = verification.amount;
    const platformFeeRate = CONFIG.SMALL_BUSINESS_RATE; // Use 15% if eligible
    const platformFee = grossAmount * platformFeeRate;
    const netAmount = grossAmount - platformFee;
    
    // Determine plan tier
    const planId = verification.productId;
    const isYearly = planId.toLowerCase().includes('year') || planId.toLowerCase().includes('annual');
    const subscriptionTier = isYearly ? 'premium_yearly' : 'premium_monthly';
    
    // Check for duplicate transaction
    const { data: existing } = await supabase
      .from('subscription_purchases')
      .select('id')
      .eq('transaction_id', verification.transactionId)
      .maybeSingle();
    
    if (existing) {
      console.log('Duplicate transaction detected:', verification.transactionId);
      return { success: false, error: 'Transaction already processed' };
    }
    
    // Insert purchase
    const { data: purchase, error } = await supabase
      .from('subscription_purchases')
      .insert({
        user_id: userId,
        plan_id: planId,
        platform,
        transaction_id: verification.transactionId,
        original_transaction_id: verification.originalTransactionId,
        receipt_data: receipt.substring(0, 1000), // Truncate for storage
        purchase_date: verification.purchaseDate.toISOString(),
        expiry_date: verification.expiryDate.toISOString(),
        is_trial: verification.isTrial,
        auto_renewing: verification.autoRenewing,
        status: 'active',
        gross_amount: grossAmount,
        platform_fee: platformFee,
        net_amount: netAmount,
        currency: verification.currency,
        is_sandbox: verification.isSandbox || false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database insert error:', error);
      return { success: false, error: error.message };
    }
    
    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: subscriptionTier,
        subscription_status: 'active',
        subscription_expires_at: verification.expiryDate.toISOString(),
        subscription_platform: platform,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    
    if (profileError) {
      console.error('Profile update error:', profileError);
    }
    
    // Update revenue (async, don't wait)
    updateRevenueReports(supabase, {
      date: new Date().toISOString().split('T')[0],
      grossAmount,
      platformFee,
      netAmount,
      platform,
    }).catch(console.error);
    
    return { success: true, purchase };
    
  } catch (error) {
    console.error('Save purchase error:', error);
    return { success: false, error: error.message };
  }
}

async function updateRevenueReports(supabase: any, data: any) {
  const { date, grossAmount, platformFee, netAmount, platform } = data;

  try {
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
          updated_at: new Date().toISOString(),
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
  } catch (error) {
    console.error('Revenue report error:', error);
  }
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  console.log(`[${requestId}] 💰 Purchase verification started at ${new Date().toISOString()}`);
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Only POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        requestId,
      }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Check configuration
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      console.error(`[${requestId}] ❌ Missing Supabase configuration`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error',
          code: 'CONFIG_ERROR',
          requestId,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    const tokenValidation = validateToken(authHeader);
    
    if (!tokenValidation.valid) {
      console.warn(`[${requestId}] ⚠️ Auth failed:`, tokenValidation.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: tokenValidation.error,
          code: 'UNAUTHORIZED',
          requestId,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${tokenValidation.token}` } } }
    );
    
    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(tokenValidation.token);
    
    if (userError || !user) {
      console.warn(`[${requestId}] ⚠️ User not found:`, userError?.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or expired token',
          code: 'UNAUTHORIZED',
          requestId,
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[${requestId}] 👤 User: ${user.email} (${user.id})`);
    
    // Parse and validate body
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON body',
          code: 'INVALID_JSON',
          requestId,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const validation = validateRequest(body);
    if (!validation.valid) {
      console.warn(`[${requestId}] ⚠️ Validation failed:`, validation.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: validation.error,
          code: 'VALIDATION_ERROR',
          requestId,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { platform, receipt, transactionId, isSandbox } = validation.data!;
    
    console.log(`[${requestId}] 📝 Platform: ${platform}, Sandbox: ${isSandbox}`);
    
    // Verify purchase
    let verification: VerificationResult;
    
    if (platform === 'ios') {
      if (!CONFIG.APPLE_SHARED_SECRET) {
        console.warn(`[${requestId}] ⚠️ Apple shared secret not configured`);
      }
      verification = await verifyApplePurchase(receipt, isSandbox || false);
    } else {
      verification = await verifyGooglePurchase(receipt, transactionId!);
    }
    
    if (!verification.valid) {
      console.error(`[${requestId}] ❌ Verification failed:`, verification.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: verification.error,
          code: 'VERIFICATION_FAILED',
          requestId,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[${requestId}] ✅ Verified: ${verification.productId}, Amount: ${verification.amount} ${verification.currency}`);
    
    // Initialize admin client for database operations
    const supabaseAdmin = createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_SERVICE_ROLE_KEY || CONFIG.SUPABASE_ANON_KEY
    );
    
    // Save to database
    const saveResult = await savePurchase(supabaseAdmin, user.id, verification, platform, receipt);
    
    if (!saveResult.success) {
      // Check if duplicate
      if (saveResult.error?.includes('duplicate') || saveResult.error?.includes('already processed')) {
        return new Response(
          JSON.stringify({
            success: true,
            warning: 'Transaction already processed',
            subscription: {
              tier: verification.productId.includes('yearly') ? 'premium_yearly' : 'premium_monthly',
              expiresAt: verification.expiryDate.toISOString(),
            },
            requestId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: saveResult.error,
          code: 'DATABASE_ERROR',
          requestId,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const processingTime = Date.now() - startTime;
    
    console.log(`[${requestId}] 🎉 Success in ${processingTime}ms`);
    
    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        purchase: saveResult.purchase,
        subscription: {
          tier: verification.productId.includes('yearly') ? 'premium_yearly' : 'premium_monthly',
          expiresAt: verification.expiryDate.toISOString(),
          isTrial: verification.isTrial,
          autoRenewing: verification.autoRenewing,
        },
        verification: {
          productId: verification.productId,
          transactionId: verification.transactionId,
          amount: verification.amount,
          currency: verification.currency,
          isSandbox: verification.isSandbox,
        },
        processingTime,
        requestId,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        } 
      }
    );
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Fatal error after ${processingTime}ms:`, error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message,
        code: 'INTERNAL_ERROR',
        requestId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
