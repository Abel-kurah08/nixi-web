# Nixi

A blue-themed rebuild inspired by the supplied Nixi reference screenshots/video. This package is a **sandbox/manual-review implementation**, not a production payment platform.

## Included
- Mobile-first Home, Tap, Upgrade and Me views
- Registration/login with password hashing
- APX balance and transaction history
- Tap limits by level
- Level upgrades
- APX → NGN conversion calculation and history
- Withdrawal request workflow with admin approval/rejection
- Activation request workflow with admin approval/rejection
- Bank selector
- Admin dashboard at `/admin`
- JSON-file persistence so it runs without external services

## Run
Node.js 22+:

```bash
npm start
```

Open `http://localhost:3000`.

Admin: `http://localhost:3000/admin`
Default sandbox admin key: `nixi-admin-demo`

Set `NIXI_ADMIN_KEY` and `NIXI_SESSION_SECRET` environment variables before deployment.

## Production note
The reference screens show real-money activation/withdrawal language. This build intentionally keeps payment handling in manual-review/sandbox mode. Before any real deployment, add a licensed payment provider, KYC/AML controls where legally required, secure object storage for receipts, database migrations, rate limiting, CSRF protection, audit logs, HTTPS, secrets management, and independent security review.


Updated upgrade flow: every higher level has an Upgrade button; selecting one shows the OPay-unavailable warning first, then the bank details and receipt upload screen. Blue Nixi theme retained.
