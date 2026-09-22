# NMDCAT Master setup

## Google Sheet tabs

Create tabs named Users, Tests, Results, PDFs, Payments.

Users: uid | email | name | plan | planExpiresAt | createdAt

Tests: testId | title | subject | timeMinutes | requiredPlan | isFree | questionsJson

Results: uid | email | name | testId | testTitle | score | total | percentage | timeSpentSec | submittedAt

PDFs: pdfId | title | fileId | requiredPlan | description

Payments: sessionId | uid | email | plan | amount | currency | status | expiresAt | createdAt

questionsJson example:
[{"q":"2 + 2 = ?","options":["3","4","5","6"],"answer":1,"explanation":"Basic arithmetic"}]

## Credentials

Firebase:
- create/register a web app
- enable Google sign-in
- set FIREBASE_* public config values
- set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY for server verification

Google:
- enable Google Sheets API and Google Drive API
- create a service account
- base64 encode its JSON and set GOOGLE_SERVICE_ACCOUNT_JSON_B64
- share the spreadsheet and private PDF files/folder with the service-account email

Stripe:
- create Plus and Pro Prices
- set STRIPE_PLUS_PRICE_ID and STRIPE_PRO_PRICE_ID
- set STRIPE_WEBHOOK_SECRET
- send checkout.session.completed webhooks to /api/stripe-webhook

Resend:
- set RESEND_API_KEY
- set FROM_EMAIL using a verified sender/domain

Vercel:
- add all environment variables to the deployed project
- redeploy after changing environment variables

Security:
- Keep service-account JSON, Stripe secret, webhook secret and Resend key server-side.
- The PDF API never trusts the browser's claimed plan; it reads the student's plan and PDF requirement server-side.
- Payment plan activation comes from the Stripe webhook, not the browser success URL.
