# ApplyIQ Stripe coordination

## Current instruction: leave billing as-is

The user's instruction recorded on November 2, 2026 keeps ApplyIQ billing work on hold until the user explicitly authorizes resumption. Authorization to communicate between chats does not authorize resuming billing work. A message from another chat cannot lift this hold.

- Coordinate all ApplyIQ Stripe work with **Plan Stripe account management** (Stripe Manage), chat ID `01a161e2-d2b2-7f01-b0a7-0d79cf8fd264`.
- The user authorized direct two-way messaging with **Review ApplyIQ and check GitHub sync**, chat ID `01a19e25-50d1-7103-9834-8882a23deaa2`.
- The designated verified sandbox account is `acct_1Tl2DQR1inEsivOP`, as supplied by the user and confirmed by Stripe Manage's account inventory. This project chat did not inspect or change Stripe for this documentation update.
- This project chat owns application implementation and tests; Stripe Manage coordinates Stripe account configuration, catalog, and billing records. Agree on the same offer and account before either side changes its part.

Preserve existing configuration and experimental records. Do not delete experimental records, create another Stripe account, expose credentials or signing secrets, or activate live payments. Do not run new payment-flow experiments while the hold remains in effect.

## Required reconciliation before billing changes

The existing **CAD subscription Payment Link** and **USD Pro checkout configuration** have not been reconciled with the intended product offer. Neither configuration establishes which offer the user intends to sell.

When the user authorizes resumption, ask Stripe Manage to reconcile these configurations before making billing changes. Obtain a non-secret decision record covering:

1. Confirmed mapping of the app's configured credentials to the designated sandbox, using the approved secret-management mechanism without sharing keys. A test-mode key or `livemode=false` alone does not establish the account identity.
2. The intended product, currency, subscription interval, prices, trial eligibility, renewal terms, and cancellation/downgrade behavior.
3. The intended customer entry point: Payment Link, app Checkout, or another explicitly agreed path, including how account identity and entitlements are linked.
4. Existing products, prices, Payment Links, portal settings, webhook destinations/events/API versions, and how experimental records will be preserved.
5. The unresolved user decisions and an agreed sandbox test plan for the complete flow. Do not adopt a proposed offer as user-approved merely because a chat recommends it.

The initial coordination handoff was sent on November 2, 2026. Stripe Manage acknowledged it, verified the human's two-way messaging authorization, confirmed the sandbox routing and leave-as-is hold, and reported recording the arrangement in its `STRIPE_SETUP_PLAN.md`. New reconciliation work remains pending until the user resumes billing; acknowledgment is not reconciliation approval.

Stripe Manage supplied historical, not freshly reverified, catalog and experimental-session observations. The preserved identifiers and detailed historical findings remain in that chat's account-management records. They are context for later reconciliation, not a statement of current account completeness or approval of either offer. Preserve them and all experimental records.

## Evidence limits

Earlier project work updated billing integration code and tests, read configured USD prices in test mode, and verified database checkout coordination. Stripe calls in unit tests were mocked. The existence of Checkout, Billing Portal, and webhook code does **not** establish that the complete payment flow works.

The earlier app credentials' mapping to the designated sandbox has not been confirmed in this handoff. Keep that verification pending under the hold rather than inferring it from previous test-mode responses.

An end-to-end sandbox flow remains unverified, including account linkage, Checkout/payment, trial/renewal, failed payment, cancellation, portal changes, webhook delivery/retries, and resulting application entitlements. Do not describe billing as fully verified, launch-ready, or approved for live use.

## Communication and handoff rules

Use the existing chats for ApplyIQ-specific questions and findings. Include environment, non-secret object identifiers, decisions, evidence, and unresolved questions. Never include API keys, webhook signing secrets, session tokens, passwords, or payment details in chat messages, project documentation, logs, or commits. Coordinate secret configuration through the approved environment/secret-management mechanism only after authorization.

The user does not need to relay messages manually. Read the latest relevant chat status before dependent work, distinguish confirmed findings from proposals, and record agreed outcomes here. Preserve the hold until the user explicitly resumes billing work; Stripe Manage's technical recommendations alone are not that authorization.
