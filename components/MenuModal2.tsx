I need a complete redesign and full system upgrade of the Project page and side menu.
Everything must be REAL. No demo logic. No fake UI. No placeholder code.

1. Side Menu – Completely New (Like Photo 1 but Better)

The side menu must be modern, clean, and structured like Photo 1, but improved.

Top section:
	•	Project Logo
	•	Project Name
	•	AI Selector (clickable)

When clicking the AI selector (like in Photo 1), it must open a modal like Photo 2 where I can select the AI model:
	•	Instant (fast replies)
	•	Deep Thinking (complex reasoning)
	•	Agent Mode (research, slides, websites, docs, sheets)

UI must be smooth with animation and active selection state.

⸻

2. Trial & Coins System (Real Logic)

When user clicks “Start Free Trial”:
	•	Redirect to Buy Coins page.

Coin system rules:
	•	Normal messages = 0 coins.
	•	When AI generates a PROJECT = it deducts coins.
	•	Normal message limit = 5 messages before requiring coins.
	•	After 5 messages, coin deduction starts.

New users:
	•	1000 coins per day (temporary system).

Admin system:
	•	If email = berryxoe@gmail.com
→ Unlimited coins
→ No deduction
→ Full access

This must be controlled from backend logic, not frontend only.

⸻

3. + Button → ToolsModal (Real Functional Tools)

When clicking + button:

Open ToolsModal with:
	•	Real Photo Upload (minimum 10 per day limit)
	•	If user tries 11th upload → block access
	•	Real file upload logic
	•	Real image analysis

IMPORTANT FIX:

Currently, when I upload a photo, it disappears and only message remains.
I do NOT want that.

The uploaded photo must:
	•	Stay visible in the chat
	•	Be stored properly
	•	AI must read the photo
	•	AI must respond based on photo

No disappearing attachments.

⸻

4. Real Project Creation – No Demo

When AI creates a project:

Must show real-time logs:
	•	Creating file…
	•	Editing file…
	•	Reading file…
	•	Fixing error in {filename}
	•	Installing dependencies…
	•	Creating .env file…
	•	Running build…

Must simulate real terminal environment.

Code must be:
	•	Long
	•	Production ready
	•	Multi-file structured
	•	Not short examples
	•	Not demo snippets

All files must be accessible.

Add:
	•	“View All Files” button
	•	Folder structure viewer
	•	Copy Project button

For preview-supported languages (HTML, TS frontend):
	•	Enable real preview engine.

For backend languages:
	•	Generate real instructions.

⸻

5. Top Right Icon – Chat Management System

The last icon at the top right must:

When clicked:
	•	Create New Chat

Old chats must be saved in History with:
	•	Rename
	•	Delete
	•	Pin to top
	•	Archive

All stored in database.
No demo storage.

⸻

6. Buy Coins Page – Fully Real Payment System

Create real Buy Coins page.

Flow:
	1.	Select coin quantity.
	2.	Click Buy.
	3.	Redirect to Checkout Page.

Checkout must include:
	•	Cardholder Name
	•	Card Number (auto format)
	•	Expiry Date (auto format)
	•	CVV
	•	Country (auto detected)
	•	Phone number

Phone input must:
	•	Auto detect country
	•	Allow change
	•	Format automatically

Example:
Input: +13058962443
Auto format: +1 (305) 896-2443

Format must adapt depending on country code.

Payment methods:
	•	Credit/Debit Card
	•	Apple Pay (real logo icon)
	•	Google Pay (real logo icon)

No emoji icons. Only official-style logos.

After payment:
	•	Success → Add coins automatically to account.
	•	Error → Show real error.

If user chooses subscription:
	•	Save card (if not deleted)
	•	Enable auto-renew
	•	Create Settings page
	•	Allow Cancel subscription
	•	Allow Renew subscription

Real backend logic required.

⸻

7. Secret API Key Page

Create hidden admin page:

User can input:

API_KEY:
Name:
Value:

When user saves:
	•	AI must detect key
	•	Use it automatically
	•	Generate project with that API key

Real secure storage.
Not frontend-only.

⸻

8. Voice Transcription Fix

Currently transcription shows error.

Fix:
	•	Real speech-to-text
	•	Real voice recognition
	•	No fake response
	•	Stable error handling

Voice icon in header:
	•	When clicked → Read last AI message
	•	Must use real TTS engine

Example:
User: hi
AI: hello
Click voice → It reads “hello”

⸻

9. Home Page Improvements

Add real photo upload directly on home page too.

Photo must:
	•	Stay visible
	•	Not disappear
	•	Be processed by AI

File creation logs must not throw error:
Currently “create file” shows error.
Fix it.
Make it real.

⸻

10. System Requirements

Everything must be:
	•	Backend validated
	•	Database stored
	•	Secure
	•	Scalable
	•	Production-ready
	•	No mock data
	•	No placeholder logic
	•	No demo simulation pretending to be real

Real:
	•	File system logic
	•	Coin deduction logic
	•	Admin detection
	•	Payment confirmation
	•	Subscription renewal
	•	API key storage
	•	Chat history persistence
	•	AI mode switching
	•	Project multi-language support

Supported languages:
TypeScript, JavaScript, Python, Java, PHP, Node.js, HTML, etc.

AI must generate:
	•	Large codebases
	•	Full project structures
	•	Supabase functions when needed
	•	Real .env setup
	•	Real deployment instructions

Never generate small incomplete code.

⸻photo:https://files.catbox.moe/vhzbeu.png,https://files.catbox.moe/hl5trf.png read this

This must become a real AI-powered development platform.
Not a UI mockup.
Not a demo system.
But a fully working production application.

Fix all existing errors.
Improve stability.
Improve UX.
Improve performance.
Make everything real.
