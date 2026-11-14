# Razorpay webhook setup

The server-side webhook endpoint is:

`https://zyvra-v2.vercel.app/api/razorpay-webhook`

## Environment

Configure `RAZORPAY_WEBHOOK_SECRET` in Vercel for the same deployment environment as the Razorpay webhook. This secret is separate from `RAZORPAY_KEY_SECRET`; neither secret is exposed to the browser.

## Razorpay Dashboard

1. Open Razorpay Dashboard and select the correct test or live mode.
2. Add the URL above as a webhook endpoint.
3. Set the webhook secret to the value of `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe to `payment.captured` and `order.paid`.
5. Send a test webhook and confirm a `200` response.

The handler validates the raw-body HMAC signature, order association, amount, currency, and payment ID before invoking the service-role-only atomic fulfillment RPC. Duplicate events are safe because the RPC locks the payment order row and returns without repeating entitlement or coin operations after the order is paid.

## Database migration safety

Apply `supabase/migrations/20261115010000_atomic_razorpay_webhook_fulfillment.sql` only after reviewing its preflight output. It does not delete or merge data. It aborts if duplicate wallets or non-empty gateway/payment IDs exist, so those rows can be reconciled manually without guessing.

The migration removes student payment-order insert/update/delete policies while preserving the authenticated `create_checkout_order` RPC. The webhook RPC accepts the internal payment-order UUID and Razorpay gateway order ID separately. Legacy rows marked `paid` without a payment ID are not trusted by the authenticated callback; a fresh, signature-verified webhook with matching order, amount, and currency is required to reconcile them.

## Verification

In the Razorpay Dashboard, inspect the webhook delivery log for the event and response status. In Supabase, verify that the matching `payment_orders` row is `paid`, has the Razorpay payment ID, has one active `user_access` row for the purchased item, and has only one redemption entry for any redeemed coins.

Production readiness still requires a successful Razorpay test-mode delivery against the deployed endpoint; local automated tests do not replace that verification.

## Safe application commands

Run these commands from the repository root after taking a database backup and reviewing the duplicate checks:

```bash
supabase db push --dry-run
supabase db push
```

If the migration stops on a duplicate, use the SQL shown in the exception hint to produce a reconciliation report. Do not delete or merge rows automatically; resolve the duplicate set and rerun the migration only after approval.
