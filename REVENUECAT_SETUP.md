# RevenueCat Setup Guide

Complete step-by-step instructions to connect RevenueCat in-app purchases for **Dawinix** (iOS & Android).

---

## Table of Contents

1. [Create Products in App Store Connect](#1-app-store-connect-ios)
2. [Create Products in Google Play Console](#2-google-play-console-android)
3. [Configure RevenueCat Dashboard](#3-revenuecat-dashboard)
4. [Map Product Identifiers](#4-product-identifier-mapping)
5. [Sandbox Testing](#5-sandbox-testing)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. App Store Connect (iOS)

### 1.1 Create a Subscription Group

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → select your app.
2. Click **Monetization** → **Subscriptions**.
3. Click **+** to create a new **Subscription Group**.
   - Name: `Dawinix Pro`
4. Save.

### 1.2 Create Each Subscription Product

Create 4 products inside the group:

| Display Name         | Product ID                        | Duration |
|----------------------|-----------------------------------|----------|
| Dawinix Lite Monthly | `app.dawinix.lite.monthly`        | 1 Month  |
| Dawinix Lite Annual  | `app.dawinix.lite.annual`         | 1 Year   |
| SuperDawinix Monthly | `app.dawinix.super.monthly`       | 1 Month  |
| SuperDawinix Annual  | `app.dawinix.super.annual`        | 1 Year   |

For **SuperDawinix Monthly** only, enable the 3-day free trial:
- **Introductory Offer** → Free Trial → 3 Days.

### 1.3 Pricing

| Product              | Price Tier (USD) |
|----------------------|------------------|
| Lite Monthly         | $9.99 (Tier 10)  |
| Lite Annual          | $99.99 (Tier 100)|
| Super Monthly        | $29.99 (Tier 30) |
| Super Annual         | $299.99 (Tier 300)|

### 1.4 Submit for Review
Each subscription product must be submitted for **App Review** before it's live.

---

## 2. Google Play Console (Android)

### 2.1 Create Subscription Products

1. Go to [Google Play Console](https://play.google.com/console) → select your app.
2. Click **Monetize** → **Subscriptions**.
3. Click **Create subscription**.

Create 2 base subscriptions:

| Subscription ID              | Name                  |
|------------------------------|-----------------------|
| `app.dawinix.lite`           | Dawinix Lite          |
| `app.dawinix.super`          | SuperDawinix          |

### 2.2 Add Base Plans (Billing Periods)

For each subscription, add base plans:

**Dawinix Lite:**
- Base plan ID: `monthly` → Price: $9.99 → Monthly
- Base plan ID: `annual`  → Price: $99.99 → Yearly

**SuperDawinix:**
- Base plan ID: `monthly` → Price: $29.99 → Monthly → add 3-day free trial offer
- Base plan ID: `annual`  → Price: $299.99 → Yearly

### 2.3 Activate Products
Activate all base plans before testing.

---

## 3. RevenueCat Dashboard

### 3.1 Create a RevenueCat Account
Go to [https://app.revenuecat.com](https://app.revenuecat.com) and sign in.

### 3.2 Create a New Project
1. Click **+ New Project** → Name: `Dawinix`
2. Add your iOS App:
   - Bundle ID: your app bundle (e.g. `app.dawinix.ios`)
   - App Store Connect API Key (from ASC → Users → Integrations → API Keys)
3. Add your Android App:
   - Package Name: e.g. `app.dawinix.android`
   - Upload your Google Play Service Account JSON

### 3.3 Create Entitlements

Go to **Entitlements** → **+ New Entitlement**:

| Identifier    | Description              |
|---------------|--------------------------|
| `lite`        | Dawinix Lite access      |
| `super`       | SuperDawinix full access |

### 3.4 Create Products in RevenueCat

Go to **Products** → **+ New Product** for each store:

**iOS Products:**

| Identifier                    | Entitlement |
|-------------------------------|-------------|
| `app.dawinix.lite.monthly`    | `lite`      |
| `app.dawinix.lite.annual`     | `lite`      |
| `app.dawinix.super.monthly`   | `super`     |
| `app.dawinix.super.annual`    | `super`     |

**Android Products** (use base plan format `productId:basePlanId`):

| Identifier                        | Entitlement |
|-----------------------------------|-------------|
| `app.dawinix.lite:monthly`        | `lite`      |
| `app.dawinix.lite:annual`         | `lite`      |
| `app.dawinix.super:monthly`       | `super`     |
| `app.dawinix.super:annual`        | `super`     |

### 3.5 Create Offerings

Go to **Offerings** → **+ New Offering**:

| Identifier  | Description               |
|-------------|---------------------------|
| `default`   | Default paywall offering  |

**Add Packages to `default` offering:**

| Package ID   | Package Type | iOS Product                  | Android Product              |
|--------------|--------------|------------------------------|------------------------------|
| `$rc_monthly`| Monthly      | `app.dawinix.super.monthly`  | `app.dawinix.super:monthly`  |
| `$rc_annual` | Annual       | `app.dawinix.super.annual`   | `app.dawinix.super:annual`   |
| `lite_mo`    | Custom       | `app.dawinix.lite.monthly`   | `app.dawinix.lite:monthly`   |
| `lite_yr`    | Custom       | `app.dawinix.lite.annual`    | `app.dawinix.lite:annual`    |

### 3.6 Copy Your API Keys

Go to **Project Settings** → **API Keys**:

| Key Name           | Where to use                        |
|--------------------|-------------------------------------|
| iOS Public Key     | `EXPO_PUBLIC_RC_IOS_KEY` in `.env`  |
| Android Public Key | `EXPO_PUBLIC_RC_ANDROID_KEY` in `.env` |

---

## 4. Product Identifier Mapping

The app uses these constants in `app/subscription.tsx`:

```typescript
const RC_PRODUCTS = {
  lite_monthly:  'app.dawinix.lite.monthly',
  lite_annual:   'app.dawinix.lite.annual',
  super_monthly: 'app.dawinix.super.monthly',
  super_annual:  'app.dawinix.super.annual',
};
```

**These must exactly match** the Product IDs you created in:
- App Store Connect (iOS)
- RevenueCat Products panel

For Android, RevenueCat maps `app.dawinix.lite:monthly` → internally resolved to the same offering package. The app looks up packages by type (`MONTHLY`/`ANNUAL`) as fallback if the exact product ID is not found.

---

## 5. Sandbox Testing

### iOS Sandbox

1. In App Store Connect → **Users and Access** → **Sandbox Testers** → create a test Apple ID (use a fake email not registered with Apple).
2. On your test device: **Settings** → **App Store** → sign out of production account → sign in with sandbox account.
3. Run the app in debug mode (`__DEV__ === true`).
4. Trigger a purchase — it will not charge real money.

> **Note:** Sandbox subscriptions renew every few minutes (1 month = ~5 minutes in sandbox).

### Android Sandbox

1. Go to Google Play Console → **Setup** → **License Testing** → add your Google account email as a license tester.
2. Make sure the app is published to at least **Internal Testing** track.
3. Install from the Internal Testing link (not sideloaded).
4. Purchases made with a license tester account are free.

### Verifying Purchase in RevenueCat

After a sandbox purchase:
1. Go to RevenueCat Dashboard → **Customer Lookup**.
2. Search by your Supabase user ID (passed as `appUserID` during `configure()`).
3. You should see active entitlements.

---

## 6. Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `No packages available` | Offering not configured in RC | Create `default` offering with packages |
| `BootFailure` in chat function | Syntax error in Edge Function | Re-deploy function |
| `Could not connect to the store` | RC not configured / API key wrong | Check `EXPO_PUBLIC_RC_IOS_KEY` in `.env` |
| Products show but purchase fails | Product not approved in ASC | Submit products for App Review |
| Android purchase fails | App not on Internal Testing track | Publish to Internal Testing in Play Console |
| `Product not found` | Product ID mismatch | Verify IDs match exactly between ASC/RC and `RC_PRODUCTS` |
| Sandbox purchases not reflected | RC webhook delay | Wait ~30 seconds and check RC dashboard |
| Restore shows nothing | Different Apple ID in sandbox | Use the same sandbox tester account |

---

## Environment Variables Required

Add these to your `.env` file:

```bash
EXPO_PUBLIC_RC_IOS_KEY=appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_RC_ANDROID_KEY=goog_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

These are also set as **Secrets** in OnSpace Cloud for Edge Functions that verify purchases.

---

## Purchase Flow Summary

```
User taps "Upgrade"
  → RC.configure(apiKey, appUserID: supabase_user_id)
  → RC.getOfferings() → find matching package
  → RC.purchasePackage(pkg)
  → customerInfo returned
  → POST /functions/v1/verify-purchase (backend sync)
  → user_profiles.subscription_tier updated in DB
  → SubscriptionContext.upgradeTierOptimistic() → instant UI update
  → router.push('/subscription-success')
```
