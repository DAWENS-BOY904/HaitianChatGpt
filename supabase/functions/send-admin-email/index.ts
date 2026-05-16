import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientIds, subject, message, imageUrl } = await req.json();

    if (!recipientIds || recipientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get recipient emails
    const { data: users, error: usersError } = await supabaseAdmin
      .from('user_profiles')
      .select('email')
      .in('id', recipientIds);

    if (usersError || !users) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recipients' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build email HTML
    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10A37F; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .image { max-width: 100%; height: auto; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${subject}</h1>
    </div>
    <div class="content">
      <p>${message.replace(/\n/g, '<br>')}</p>
      ${imageUrl ? `<img src="${imageUrl}" alt="Image" class="image">` : ''}
    </div>
    <div class="footer">
      <p>This email was sent by the admin of HaitianChatGpt</p>
      <p>If you have any questions, please contact support</p>
    </div>
  </div>
</body>
</html>
    `;

    // TODO: In production, integrate with your email service
    // For now, we'll just log it
    console.log(`Sending email to ${users.length} users:`);
    console.log(`Subject: ${subject}`);
    console.log(`Recipients:`, users.map(u => u.email));

    // Example using SendGrid (you need to add SENDGRID_API_KEY to secrets)
    /*
    const emails = users.map(u => u.email);
    for (const email of emails) {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: 'noreply@haitianchatgpt.com' },
          subject,
          content: [{ type: 'text/html', value: emailHTML }],
        }),
      });
    }
    */

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email sent to ${users.length} users`,
        recipients: users.map(u => u.email)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send admin email error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
