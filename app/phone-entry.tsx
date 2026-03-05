Implement Real Phone Login with Country Detection and Auto Formatting

Connect the phone input system with the real authentication login system. The phone login must use Supabase Phone Authentication (not demo or mock). I will provide the Supabase keys and cloud secrets later, so make sure the system is prepared to use them.

1. Country Selection (200+ Countries)

Add a country selector that includes 200+ countries worldwide.

Each country must display:

Country name

Country flag

Country calling code (example: +1, +44, +509, etc.)

The system should automatically detect the user's country based on device locale or IP and set the default country automatically.

2. Phone Number Auto Format

The phone input field must auto-format the phone number based on the selected country.

Example for United States:

❌ Wrong format: +13058963443

✅ Correct format: +1 (305) 896-3443

The formatting should update while the user types to make the number easy to read.

Use international phone formatting standards so every country number is formatted correctly.

3. Phone Login Flow

Create a real authentication flow using Supabase.

Step-by-step flow:

User enters phone number.

User presses Continue.

The system sends a verification code (OTP) using Supabase.

Navigate to the Phone Code Verification Page.

User enters the OTP code received on their phone.

The system verifies the code with Supabase.

If successful, the user is logged in.

This must be fully functional with Supabase, not a demo.

4. OTP Code Page

The verification page must include:

OTP input fields (example: 6 digits)

Auto focus between inputs

Clear design and smooth animations

Countdown timer before resend is available

Example behavior:

“Resend code in 30 seconds”

After countdown → Resend Code button becomes active

5. Resend Code System

Allow the user to request a new verification code if needed.

Requirements:

Button disabled during countdown

Prevent spam requests

Use Supabase to send a new OTP

6. UI / Design

Make the interface clean, modern, and beautiful.

Design suggestions:

Smooth transitions between screens

Large readable input fields

Country flag icon inside the phone input

Clear Continue button

Proper error messages

Example errors:

Invalid phone number

Failed OTP verification

Network error

7. Real Authentication

Important requirements:

Use real Supabase phone authentication

Store the authenticated session correctly

Handle login state after success

Redirect user to the main app after login

This must be a production-ready login system, not a placeholder or mock implementation.
