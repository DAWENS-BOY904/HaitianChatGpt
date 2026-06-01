# Approve Web Login — Integration Guide

## Overview

This feature sends a push notification to the user's mobile device when someone attempts to log in from a web browser. The mobile user can approve or deny the request from the `/new-device-verify` screen.

---

## Architecture

```
Web Browser Login
       │
       ▼
  app/login.tsx (web)
       │ inserts record into activity_logs with action_type='web_login_request'
       │ calls notify-web-login edge function
       ▼
  supabase/functions/notify-web-login/index.ts
       │ reads push_token from user_profiles
       │ sends Expo push notification with deep link
       ▼
  Mobile Device (Expo Push)
       │ user taps notification
       ▼
  app/new-device-verify.tsx
       │ shows Approve / Deny buttons
       │ updates activity_logs.details.approval_status
       ▼
  Web Browser polls activity_logs every 3 seconds
       │ approval_status = 'approved' → redirect to /home
       │ approval_status = 'denied'   → show error message
       │ timeout after 10 minutes     → auto-cancel
```

---

## Database Schema

The feature uses the existing `activity_logs` table with these fields:

| Field | Type | Usage |
|-------|------|-------|
| `id` | uuid | The `requestId` — passed in push notification deep link |
| `user_id` | uuid | User attempting web login |
| `action_type` | text | Always `'web_login_request'` |
| `action` | text | Human-readable e.g. `'Web login request from Chrome'` |
| `ip_address` | text | Client IP of the web login attempt |
| `user_agent` | text | Browser user-agent string |
| `details` | jsonb | Contains `expires_at`, `approval_status`, `decided_at` |

### details JSON structure:
```json
{
  "expires_at": "2024-01-01T12:10:00.000Z",
  "approval_status": "pending" | "approved" | "denied",
  "decided_at": "2024-01-01T12:05:00.000Z"
}
```

---

## Step 1 — Insert Web Login Request (in login.tsx web flow)

After the user successfully authenticates on web, insert a pending record:

```typescript
import { getSupabaseClient } from '@/template';

async function createWebLoginRequest(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      action: 'Web login request',
      action_type: 'web_login_request',
      details: {
        expires_at: expiresAt,
        approval_status: 'pending',
      },
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return data.id;
}
```

---

## Step 2 — Send Push Notification

Call the edge function to notify the mobile device:

```typescript
async function notifyMobileDevice(userId: string, requestId: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.functions.invoke('notify-web-login', {
    body: {
      userId,
      requestId,
      ipAddress: '', // optional — you can detect from browser
      userAgent: navigator.userAgent,
    },
  });

  if (error) {
    console.warn('Push notification failed (non-fatal):', error);
  }
}
```

---

## Step 3 — Show Waiting Screen & Poll for Approval

```typescript
const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

async function waitForApproval(
  requestId: string,
  onApproved: () => void,
  onDenied: () => void,
  onTimeout: () => void,
): Promise<void> {
  const supabase = getSupabaseClient();
  const startTime = Date.now();

  const poll = async () => {
    // Check timeout
    if (Date.now() - startTime > TIMEOUT_MS) {
      onTimeout();
      return;
    }

    const { data, error } = await supabase
      .from('activity_logs')
      .select('details')
      .eq('id', requestId)
      .single();

    if (!error && data) {
      const details = data.details as any;
      const status = details?.approval_status;

      if (status === 'approved') {
        onApproved();
        return;
      }
      if (status === 'denied') {
        onDenied();
        return;
      }
    }

    // Still pending — poll again
    setTimeout(poll, POLL_INTERVAL_MS);
  };

  poll();
}
```

---

## Step 4 — Full Web Login Flow (Complete Example)

```typescript
const [webLoginState, setWebLoginState] = useState<
  'idle' | 'waiting_approval' | 'approved' | 'denied' | 'timeout'
>('idle');
const [requestId, setRequestId] = useState<string | null>(null);
const pollTimerRef = useRef<any>(null);

async function handleWebLogin(userId: string) {
  // 1. Create the request record
  const reqId = await createWebLoginRequest(userId);
  if (!reqId) {
    // No push token or insert failed — skip approval flow
    router.replace('/home');
    return;
  }

  setRequestId(reqId);
  setWebLoginState('waiting_approval');

  // 2. Send push notification
  await notifyMobileDevice(userId, reqId);

  // 3. Poll for decision
  waitForApproval(
    reqId,
    () => {
      setWebLoginState('approved');
      router.replace('/home');
    },
    () => {
      setWebLoginState('denied');
      // Sign user out on web
      getSupabaseClient().auth.signOut();
    },
    () => {
      setWebLoginState('timeout');
      getSupabaseClient().auth.signOut();
    },
  );
}

// Cancel function
function handleCancelLogin() {
  if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  if (requestId) {
    getSupabaseClient()
      .from('activity_logs')
      .update({ details: { approval_status: 'denied', decided_at: new Date().toISOString() } })
      .eq('id', requestId);
  }
  getSupabaseClient().auth.signOut();
  setWebLoginState('idle');
}
```

---

## Step 5 — Waiting Screen UI

Show this when `webLoginState === 'waiting_approval'`:

```tsx
{webLoginState === 'waiting_approval' && (
  <View style={styles.waitingScreen}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.waitingTitle}>Check your phone</Text>
    <Text style={styles.waitingSubtitle}>
      We sent a push notification to your mobile device.
      {'\n'}Tap "Approve" to continue.
    </Text>
    <Text style={styles.waitingTimer}>
      Expires in 10 minutes
    </Text>
    <TouchableOpacity onPress={handleCancelLogin} style={styles.cancelButton}>
      <Text style={styles.cancelButtonText}>Cancel</Text>
    </TouchableOpacity>
  </View>
)}
```

---

## Mobile Deep Link Setup

The push notification includes `data.url = '/new-device-verify?requestId=xxx'`.

To handle it in `app/_layout.tsx`:

```typescript
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

// In your root layout useEffect:
useEffect(() => {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data?.type === 'web_login_request' && data?.requestId) {
      router.push(`/new-device-verify?requestId=${data.requestId}`);
    }
  });
  return () => subscription.remove();
}, []);
```

---

## Edge Function: notify-web-login

Located at: `supabase/functions/notify-web-login/index.ts`

### Request Body:
```json
{
  "userId": "uuid",
  "requestId": "uuid",
  "ipAddress": "optional string",
  "userAgent": "optional string"
}
```

### Response:
```json
{ "success": true, "expoResult": { ... } }
```

---

## RLS Considerations

The `activity_logs` table has these relevant policies:

- `system_insert_logs` — allows any insert (WITH CHECK: true) ✅
- `users_view_own_logs` — users can SELECT their own logs ✅
- The mobile app uses the authenticated user's JWT so SELECT works ✅

For the UPDATE (setting approval_status), the authenticated user can update their own log via the `users_view_own_logs` policy scope. If updates fail, add this policy:

```sql
create policy "users_update_own_logs"
  on activity_logs for update to authenticated
  using (user_id = auth.uid());
```

---

## Security Notes

1. **Expiry check** — `new-device-verify.tsx` checks `expires_at` and blocks expired requests
2. **One-time use** — once approved/denied, the status is permanent
3. **User-scoped** — only the authenticated user can update their own `activity_logs` record
4. **10-minute timeout** — web login auto-cancels if no decision is made
5. **CSRF protection** — `requestId` is a server-generated UUID, not guessable

---

## Testing

1. Log in on web → check `activity_logs` table for a new row with `action_type='web_login_request'`
2. Check your mobile device for the push notification
3. Tap notification → opens `/new-device-verify?requestId=xxx`
4. Tap "Approve" → web browser should redirect to `/home` within 3 seconds
5. Tap "Deny" → web browser should show error and sign out

**To test without a push token:** Manually open the deep link on your phone:
`exp://your-expo-url/new-device-verify?requestId=YOUR_REQUEST_ID`
