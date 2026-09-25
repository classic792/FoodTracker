# Staff authentication

Staff are the only account type. There is no registration, role system, password reset, or refresh token. Product endpoints now use this authentication; see [PRODUCTS.md](./PRODUCTS.md).

## Setup

Run commands from `backend`. Keep the existing `.env`; `.env.example` documents the configuration without real secrets.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Existing PostgreSQL connection used by Prisma and the CLI. |
| `PORT` | API port; defaults to 5000. |
| `NODE_ENV` | Use `development` locally and `production` for deployment. |
| `JWT_ACCESS_SECRET` | Required at startup in every environment; use a cryptographically random secret of at least 32 bytes. There is no fallback. |
| `CLIENT_ORIGIN` | Exact browser frontend origin, without a trailing slash. Defaults to `http://localhost:5173` in development; explicitly required with HTTPS in production. This new setting replaces wildcard CORS for credentialed requests. |

```powershell
npx prisma generate
# Apply the existing migrations only to your intended development database:
npx prisma migrate dev
npm run seed
npm run dev
```

Prisma Client generation is separate from migration in Prisma 7. See [SEED_USERS.md](./SEED_USERS.md) for the fictional staff accounts. Seeding is manual, preserves existing accounts, and refuses production mode.

The server checks database connectivity before listening. `/health` executes a real database query each time: `200 { "status": "healthy", "database": "connected" }` or `503 { "status": "unhealthy", "database": "disconnected" }`. This health response intentionally differs from application error responses.

## Session contract

Login issues an HS256 JWT signed with `JWT_ACCESS_SECRET`, with the user UUID in `sub`, an issuance time, and a 30-minute expiration. Verification restricts the algorithm to HS256 and requires a valid UUID subject and expiration. The token contains no password or role data.

The token is sent only as the host-only `foodtracker_access_token` cookie: `HttpOnly`, `SameSite=Lax`, path `/`, 30-minute maximum age, and `Secure` in production. Local HTTP development omits `Secure`. Auth responses use `Cache-Control: no-store`. The API does not accept Bearer tokens or return JWTs in JSON. The frontend must not copy the token into localStorage.

Production requires HTTPS and same-site frontend/API hosting, such as `app.example.com` and `api.example.com`. A frontend on an unrelated site is outside this cookie design. Browser calls use `credentials: "include"`; credentialed CORS allows only `CLIENT_ORIGIN`. State-changing API requests with a different browser `Origin` receive `403 ORIGIN_FORBIDDEN`. Requests without an Origin are allowed for command-line clients; they still need a valid cookie for protected endpoints. Logout remains subject to this origin policy.

`requireAuth` extracts exactly one auth cookie and rejects malformed/duplicate cookies, invalid signatures, expired tokens, invalid subjects, deleted users, and inactive users. It loads current identity through the auth service on every protected request and attaches only `{ id, fullName, email, isActive }` to `req.user`. Disabling an account takes effect on its next request. Database failures produce a server error, not a misleading authentication failure.

Logout always returns `200` for missing, expired, or invalid sessions and clears the cookie with matching attributes. It intentionally does not use strict `requireAuth`. This is stateless logout: a copied JWT remains usable until its original expiration unless the account is disabled or deleted. There is no server denylist and no schema migration. Users log in again after 30 minutes; there is no sliding expiration or refresh.

## Endpoints

| Method and path | Request | Success |
| --- | --- | --- |
| `POST /api/auth/login` | JSON `{ "email": "alex@foodtracker.example", "password": "Alex-Dev-Only-2026!" }` | `200 { "id": "<uuid>", "fullName": "Alex Morgan", "email": "alex@foodtracker.example" }` plus cookie |
| `GET /api/auth/me` | Auth cookie | `200 { "id": "<uuid>", "fullName": "Alex Morgan", "email": "alex@foodtracker.example", "isActive": true }` |
| `POST /api/auth/logout` | No body required; cookie optional | `200 { "message": "Logged out." }` plus cookie removal |

Login trims and lowercases email, validates its syntax and 254-character limit, and accepts a nonempty password of at most 72 UTF-8 bytes without trimming or conversion. Unknown body fields are rejected. Seed `.example` emails are accepted. Joi schemas live in validators and are executed in controllers; business logic and database operations live in services.

Credential checks use `bcrypt.compare`; unknown emails use a fixed dummy cost-12 hash. Unknown email, incorrect password, and inactive account all receive precisely:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." } }
```

This response has status `401`. Dummy hashing reduces the obvious missing-user timing difference; it is not a guarantee of identical end-to-end timings.

All protected routes use `401 { "error": { "code": "UNAUTHORIZED", "message": "Authentication required." } }` for invalid sessions. Login is limited to 10 POST requests per IP per 15 minutes, including successful requests, using the process-local limiter. Exceeding the limit returns `429 RATE_LIMITED` with rate-limit headers. The limit resets on process restart and is not shared across server instances. Proxy trust is not enabled blindly; configure verified proxy topology before a reverse-proxy deployment so IP-based limiting works correctly.

Other centralized errors use the same envelope: `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `413 PAYLOAD_TOO_LARGE`, `403 ORIGIN_FORBIDDEN`, `404 NOT_FOUND`, and `500 INTERNAL_ERROR`. Unexpected errors use a fixed public message. Passwords, JWTs, raw database errors, and stack traces are not returned or logged by auth handlers. Prisma query/error logging is disabled to avoid leaking seed credential data.

## Inventory routes

All five product endpoints under `/api/products` are mounted behind `requireAuth` in `index.js` and use `Cache-Control: no-store`. See [PRODUCTS.md](./PRODUCTS.md) for their request/response contracts. Batches, storage locations, and stock movements remain future work. Mount any future inventory router behind the shared guard, before the 404 handler:

```js
import { requireAuth } from "./middleware/requireAuth.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";

app.use("/api/inventory", requireAuth, inventoryRoutes);
```

The inventory router in this example is future work, not an existing module. Protect the entire router; do not add an alternate public mount. Missing/invalid authentication then returns `401` before any inventory handler. Reuse `req.user` and the exported Prisma client, without introducing roles or a second client/pool.

## Manual verification examples (not executed)

Set the base URL to the actual backend port. From PowerShell, preserve the cookie between requests:

```powershell
$baseUrl = "http://localhost:5000"
$loginBody = @{ email = "alex@foodtracker.example"; password = "Alex-Dev-Only-2026!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType "application/json" -Body $loginBody -SessionVariable staffSession
Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -WebSession $staffSession
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/logout" -WebSession $staffSession
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/logout" -WebSession $staffSession
```

All four calls should return `200`; a following `/me` with that session should return `401`. PowerShell throws on non-success HTTP responses, so inspect the response body/status when checking failure cases.

| Manual scenario | Expected result |
| --- | --- |
| Active Alex or Sam login | `200`, safe identity only, auth cookie set |
| Body `{ "email": "nobody@foodtracker.example", "password": "Wrong-Password!" }` | `401 INVALID_CREDENTIALS` |
| Body `{ "email": "alex@foodtracker.example", "password": "Wrong-Password!" }` | Identical `401` status and body |
| Inactive account with its documented correct password | Identical `401` status and body |
| Missing email/password, invalid email, extra fields, empty password, or password over 72 bytes (including multibyte text) | `400 VALIDATION_ERROR`, no submitted values echoed |
| Raw malformed JSON body | `400 INVALID_JSON` |
| `/me` without cookie, with malformed/duplicate cookies, a tampered token, or a token older than 30 minutes | `401 UNAUTHORIZED` |
| Disable or delete logged-in account in the development database, then call `/me` | `401 UNAUTHORIZED` |
| Logout with missing/invalid/expired cookie | `200`, cookie cleared |
| Replay a saved valid token after logout | Still valid until original expiry; documented stateless behavior |
| Eleventh login POST within 15 minutes from the same IP | `429 RATE_LIMITED`; other auth endpoints are not login-rate-limited |
| Login/logout with `Origin: https://unapproved.example` | `403 ORIGIN_FORBIDDEN` |
| Browser request from configured origin with credentials included | Allowed CORS origin and cookie round trip |
| Database unavailable before startup | Server does not listen |
| Database disconnected after startup, then `/health` | `503` unhealthy/disconnected; restore database for `200` healthy/connected |
| Run seed twice on development database | No duplicate emails; existing IDs, passwords, and active status preserved |
| Seed with `NODE_ENV=production` | Nonzero exit, no seed database writes |

Before deployment, verify HTTPS cookie flags and the actual frontend origin. No automated test files or endpoint calls were added/run for this change; implementation verification is limited to JavaScript syntax checks and Prisma schema validation.
