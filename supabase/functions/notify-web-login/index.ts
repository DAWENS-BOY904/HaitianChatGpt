import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface NotifyWebLoginRequest {
  userId: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: NotifyWebLoginRequest = await req.json();
    const { userId, requestId, ipAddress, userAgent } = body;

    if (!userId || !requestId) {
      return new Response(
        JSON.stringify({ error: 'userId and requestId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user push token
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('push_token, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pushToken = profile.push_token;

    if (!pushToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'No push token registered for this user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send Expo push notification
    const expoPushPayload = {
      to: pushToken,
      sound: 'default',
      title: 'New Web Login Attempt',
      body: 'Someone is trying to sign in to your account from a web browser. Tap to approve or deny.',
      data: {
        type: 'web_login_request',
        requestId,
        screen: 'new-device-verify',
        url: `/new-device-verify?requestId=${requestId}`,
        ipAddress: ipAddress || 'Unknown',
        userAgent: userAgent || 'Unknown',
      },
      priority: 'high',
      channelId: 'security',
    };

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expoPushPayload),
    });

    const expoResult = await expoResponse.json();
    console.log('Expo push result:', JSON.stringify(expoResult));

    return new Response(
      JSON.stringify({ success: true, expoResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('notify-web-login error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
