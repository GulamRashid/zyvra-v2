# Two-device student sign-in limit

The database migration `20261116150000_limit_student_sessions_to_two_devices.sql` adds the session registry and the Supabase Custom Access Token Hook function. Student accounts can have up to two registered Supabase Auth sessions. Admin accounts are exempt so the admin account remains available for support and recovery.

## Supabase setup

The SQL migration has been applied to the linked Supabase project and the Custom Access Token Hook has been enabled for `public.enforce_two_device_limit`.

For another environment, apply the migration first, then:

1. Open **Supabase Dashboard → Authentication → Hooks**.
2. Enable **Custom Access Token** and choose **Postgres function**.
3. Select `public.enforce_two_device_limit` and save.
4. Test with a disposable student account: sign in on two separate browsers, then attempt a third sign-in. The third should be denied with a message to sign out on another device.
5. Sign out from another device in the profile page and confirm a new sign-in can take that slot.

The profile's **Sign out from other devices** action uses Supabase Auth's `scope: 'others'`; the current device remains signed in. Removed sessions are cleared from the registry the next time a token is issued.

## Operational notes

- Existing student sessions are seeded from `auth.sessions`, keeping the two most recently refreshed sessions for each account. Older sessions may need to sign in again after their current access token expires.
- Device slots identify Auth sessions, not physical hardware. Clearing browser storage or using a separate browser profile creates a new session and may count as another device.
- Supabase access tokens are stateless until expiry. Revoking a session prevents future refreshes, while a token already issued can remain usable until its normal expiry.
- Do not enable the hook before applying the migration; doing so would block new token issuance because the function would not exist.
