# RentMate Backend — Neon PostgreSQL + Node.js + Render

A functional REST API for the RentMate tenant app. **The existing Android ZIP is entirely local-only and does not connect to this API automatically.** Kotlin integration is a separate required step (see `ANDROID_INTEGRATION.md`).

## Requirements
- Node.js 20+; Neon PostgreSQL database; Render web service.
- All monetary amounts are **integer cents** (R2,500.00 = `250000`).
- Auth: bearer JWT, 7-day expiry. Passwords hashed with bcrypt.
- **Simulated payments never reduce real outstanding rent**. Only manager-recorded verified payments change the balance. Do not present simulated payments as real charges settled.
- Notifications are stored and retrievable in-app; **Android push notifications while the app is closed are NOT implemented**. See Android integration notes.

## 1. Neon
1. Create a Neon project and database (e.g. `neondb`).
2. In Neon dashboard select **Connect** and copy the **Postgres connection string** (include `sslmode=require`).
3. Keep it secret. Do not put it in the Android app, GitHub, or frontend.

## 2. Local setup (Windows PowerShell)
```powershell
cd RentMateBackend
Copy-Item .env.example .env
npm install
```
Edit `.env`: paste `DATABASE_URL`, set `NODE_ENV=development`, and generate `JWT_SECRET`:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Paste the generated secret into `.env`. Then:
```powershell
npm run db:migrate
npm run dev
```
Open `http://localhost:10000/api/health` to confirm database connectivity.

## 3. Deploy to Render
1. Create a **private** GitHub repository and push the `RentMateBackend` folder contents (do not commit `.env`).
2. In Render choose **New > Web Service**, connect the repository, select Node runtime.
3. Build command: `npm install && npm run db:migrate`.
4. Start command: `npm start`.
5. Environment: `DATABASE_URL` (Neon connection string), `JWT_SECRET` (random secret 32+ characters), `NODE_ENV=production`, `ENABLE_REMINDERS=false` initially.
6. Deploy. Test `https://YOUR-SERVICE.onrender.com/api/health`.
7. Free Render services can sleep when idle. Scheduled reminders require an **always-on** instance or an external scheduler. Set `ENABLE_REMINDERS=true` only with an always-on single instance. Scheduler runs daily at 08:00 UTC (10:00 SAST), not instantaneously.

## 4. Accounts and first household
1. Register a user via `POST /api/auth/register`. The default role is `tenant`.
2. For a real property manager, run `node scripts/promote-manager.js manager@example.com` **from a trusted local machine** with `.env` pointing to Neon. Never let public users choose the `manager` role.
3. Manager signs in, creates a household with `POST /api/households`, then issues an invite using `POST /api/manager/households/:houseId/invitations`.
4. Tenant registers, joins with `POST /api/households/join-by-code`, and manager issues a charge with `POST /api/manager/charges`.
5. Tenant dashboard, charges, chores, messages and notifications now have persistent data.

## 5. API quick reference
All endpoints start with `/api`. Except `/health`, `/auth/register`, and `/auth/login`, include `Authorization: Bearer YOUR_JWT`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health and database connectivity |
| POST | `/auth/register` | Register tenant |
| POST | `/auth/login` | Login and obtain JWT |
| GET/PATCH | `/me` | View/edit profile |
| GET/POST | `/households` | List/create household |
| POST | `/households/join-by-code` | Join using invitation |
| GET | `/households/:houseId/members` | List members |
| GET | `/dashboard` | Tenant dashboard |
| GET | `/rent/charges` | Rent charges and actual balances |
| GET | `/payments` | Verified and simulated history, separated |
| POST | `/payments/simulate` | Store simulated payment (no balance change) |
| GET/POST | `/households/:houseId/chores` | List/create chores |
| PATCH | `/chores/:choreId` | Mark complete/incomplete |
| GET/POST | `/households/:houseId/messages` | Read/send messages |
| GET | `/households/:houseId/announcements` | Read announcements |
| GET | `/notifications` | Read notification inbox |
| PATCH | `/notifications/:notificationId/read` | Mark read |
| GET | `/activity` | Recent activity |
| POST | `/manager/households/:houseId/invitations` | Generate one-use 7-day invitation |
| POST | `/manager/households/:houseId/announcements` | Post announcement and notify tenants |
| POST | `/manager/charges` | Issue rent charge |
| POST | `/manager/payments/verified` | Record real verified payment manually |
| GET | `/manager/households/:houseId/ledger` | Manager rent ledger |

### Example API requests
Register:
```json
{"name":"Mcondisi","email":"mcondisi@example.com","password":"strongpassword123"}
```
Create household:
```json
{"name":"The Green House","address":"Campus Road"}
```
Create charge (manager only):
```json
{"household_id":"HOUSEHOLD_UUID","tenant_id":"TENANT_UUID","amount_cents":250000,"due_date":"2026-10-31","description":"October rent"}
```
Simulate payment (tenant):
```json
{"charge_id":"CHARGE_UUID","amount_cents":100000}
```
Create chore:
```json
{"title":"Clean kitchen","assigned_to":"TENANT_UUID","due_date":"2026-10-31"}
```
Send message:
```json
{"body":"The kitchen meeting is at 6pm"}
```

## Limitations and next steps
- No real payment gateway, automatic bank reconciliation, or proof of payment verification.
- No FCM/device push integration; notification inbox exists, but Android needs API integration and foreground polling to show new items.
- No manager web UI included (manager endpoints ready for one).
- No password-reset email, email verification, file uploads, or lease signing.
- Demo flow cannot be connected without changing Android Kotlin code.
- For production: add request/response integration tests, monitoring, backups, stronger manager onboarding, password reset, and a dedicated reminder worker.
