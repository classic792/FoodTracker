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

Login returns the JWT as `accessToken` in JSON, with `tokenType: "Bearer"` and `expiresIn: 1800` (seconds). Existing identity fields (`id`, `fullName`, `email`) remain at the top level. Send `Authorization: Bearer <accessToken>` to authenticate Postman or other API clients.

The same token is also sent as the host-only `foodtracker_access_token` cookie: `HttpOnly`, `SameSite=Lax`, path `/`, 30-minute maximum age, and `Secure` in production. Local HTTP development omits `Secure`. Auth and inventory responses use `Cache-Control: no-store`. Browser clients can continue using cookies without storing the returned token in localStorage.

Production requires HTTPS and same-site frontend/API hosting for cookie authentication, such as `app.example.com` and `api.example.com`. A frontend on an unrelated site is outside this cookie design. Browser calls use `credentials: "include"`; credentialed CORS allows only `CLIENT_ORIGIN`. State-changing API requests with a different browser `Origin` receive `403 ORIGIN_FORBIDDEN`. Requests without an Origin are allowed for command-line clients; they still need a valid Bearer token or cookie for protected endpoints. Logout remains subject to this origin policy.

`requireAuth` uses the Authorization header when present; the Bearer scheme is case-insensitive and requires one token. Malformed/unsupported headers and invalid Bearer tokens return `401 UNAUTHORIZED`, even when a valid cookie is also present. With no Authorization header, it reads the auth cookie and rejects malformed/duplicate cookies. Both methods share verification of signatures, expiration, UUID subjects, and active accounts. The service loads current identity on every protected request and attaches only `{ id, fullName, email, isActive }` to `req.user`. Disabling an account takes effect on its next request. Database failures produce a server error, not a misleading authentication failure.

Logout is protected by `requireAuth`: a valid Bearer token or cookie returns `200` and clears the cookie with matching attributes; missing, expired, or invalid authentication returns `401`. This is stateless logout: a copied JWT remains usable until its original expiration unless the account is disabled or deleted. Remove the saved token from Postman after logout. There is no server denylist and no schema migration. Users log in again after 30 minutes; there is no sliding expiration or refresh.

## Endpoints

| Method and path | Request | Success |
| --- | --- | --- |
| `POST /api/auth/login` | JSON `{ "email": "alex@foodtracker.example", "password": "Alex-Dev-Only-2026!" }` | `200 { "id": "<uuid>", "fullName": "Alex Morgan", "email": "alex@foodtracker.example", "accessToken": "<jwt>", "tokenType": "Bearer", "expiresIn": 1800 }` plus cookie |
| `GET /api/auth/me` | Bearer token or auth cookie | `200 { "id": "<uuid>", "fullName": "Alex Morgan", "email": "alex@foodtracker.example", "isActive": true }` |
| `POST /api/auth/logout` | No body required; Bearer token or auth cookie | `200 { "message": "Logged out." }` plus cookie removal |

Login trims and lowercases email, validates its syntax and 254-character limit, and accepts a nonempty password of at most 72 UTF-8 bytes without trimming or conversion. Unknown body fields are rejected. Seed `.example` emails are accepted. Joi schemas live in validators and are executed in controllers; business logic and database operations live in services.

Credential checks use `bcrypt.compare`; unknown emails use a fixed dummy cost-12 hash. Unknown email, incorrect password, and inactive account all receive precisely:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." } }
```

This response has status `401`. Dummy hashing reduces the obvious missing-user timing difference; it is not a guarantee of identical end-to-end timings.

All protected routes use `401 { "error": { "code": "UNAUTHORIZED", "message": "Authentication required." } }` for invalid sessions. Login is limited to 10 POST requests per IP per 15 minutes, including successful requests, using the process-local limiter. Exceeding the limit returns `429 RATE_LIMITED` with rate-limit headers. The limit resets on process restart and is not shared across server instances. Proxy trust is not enabled blindly; configure verified proxy topology before a reverse-proxy deployment so IP-based limiting works correctly.

Other centralized errors use the same envelope: `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `413 PAYLOAD_TOO_LARGE`, `403 ORIGIN_FORBIDDEN`, `404 NOT_FOUND`, and `500 INTERNAL_ERROR`. Unexpected errors use a fixed public message. Passwords, raw database errors, and stack traces are not returned or logged by auth handlers. JWTs are returned only on successful login and are not logged by auth handlers. Prisma query/error logging is disabled to avoid leaking seed credential data.

## Inventory routes

Product and storage-location endpoints under `/api/products` and `/api/storage-locations` are mounted behind `requireAuth` in `index.js` and use `Cache-Control: no-store`. Both accept Bearer tokens or cookies. See [PRODUCTS.md](./PRODUCTS.md) and [STORAGE_LOCATIONS.md](./STORAGE_LOCATIONS.md) for their request/response contracts. Batches and stock movements remain future work. Mount any future inventory router behind the shared guard, before the 404 handler:

```js
import { requireAuth } from "./middleware/requireAuth.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";

app.use("/api/inventory", requireAuth, inventoryRoutes);
```

The inventory router in this example is future work, not an existing module. Protect the entire router; do not add an alternate public mount. Missing/invalid authentication then returns `401` before any inventory handler. Reuse `req.user` and the exported Prisma client, without introducing roles or a second client/pool.

## Manual verification examples (not executed)

### Postman Bearer tokens

`JWT_ACCESS_SECRET` is the server signing secret, not a user access token. Runtime configuration is loaded from `backend/.env`; `.env.example` is documentation only. Keep actual signing secrets out of shared example files. No configuration change is needed if login already succeeds.

1. Send `POST {{baseUrl}}/api/auth/login` with Authorization set to **No Auth**, a JSON body containing your email/password, and `Content-Type: application/json`.
2. Copy the returned `accessToken`, or save it with this Postman post-response script:

   ```js
   if (pm.response.code === 200) {
     pm.environment.set("accessToken", pm.response.json().accessToken);
   }
   ```

3. For protected requests, choose **Bearer Token** in Authorization and enter `{{accessToken}}` in the token field (without another `Bearer` prefix).
4. Call `GET {{baseUrl}}/api/auth/me`, `GET {{baseUrl}}/api/products`, or `GET {{baseUrl}}/api/storage-locations`. Expect `200` with a valid active-account token. Remove cookies from Postman to confirm header-only authentication.
5. A missing token without cookies, a tampered/expired token, `Bearer` without a token, an unsupported scheme, or a malformed header returns `401 UNAUTHORIZED`. An invalid Bearer token with a valid cookie also returns `401`.

### Cookie sessions

Set the base URL to the actual backend port. From PowerShell, preserve the cookie between requests:

```powershell
$baseUrl = "http://localhost:5000"
$loginBody = @{ email = "alex@foodtracker.example"; password = "Alex-Dev-Only-2026!" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType "application/json" -Body $loginBody -SessionVariable staffSession
Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -WebSession $staffSession
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/logout" -WebSession $staffSession
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/logout" -WebSession $staffSession
```

The first three calls should return `200`; the repeated logout and a following `/me` with that cleared session should return `401`. PowerShell throws on non-success HTTP responses, so inspect the response body/status when checking failure cases.

| Manual scenario | Expected result |
| --- | --- |
| Active Alex or Sam login | `200`, safe identity plus access token metadata, auth cookie set |
| Body `{ "email": "nobody@foodtracker.example", "password": "Wrong-Password!" }` | `401 INVALID_CREDENTIALS` |
| Body `{ "email": "alex@foodtracker.example", "password": "Wrong-Password!" }` | Identical `401` status and body |
| Inactive account with its documented correct password | Identical `401` status and body |
| Missing email/password, invalid email, extra fields, empty password, or password over 72 bytes (including multibyte text) | `400 VALIDATION_ERROR`, no submitted values echoed |
| Raw malformed JSON body | `400 INVALID_JSON` |
| `/me` without cookie, with malformed/duplicate cookies, a tampered token, or a token older than 30 minutes | `401 UNAUTHORIZED` |
| Disable or delete logged-in account in the development database, then call `/me` | `401 UNAUTHORIZED` |
| Logout with missing/invalid/expired credentials | `401 UNAUTHORIZED` |
| Replay a saved valid token after logout | Still valid until original expiry; documented stateless behavior |
| Eleventh login POST within 15 minutes from the same IP | `429 RATE_LIMITED`; other auth endpoints are not login-rate-limited |
| Login/logout with `Origin: https://unapproved.example` | `403 ORIGIN_FORBIDDEN` |
| Browser request from configured origin with credentials included | Allowed CORS origin and cookie round trip |
| Database unavailable before startup | Server does not listen |
| Database disconnected after startup, then `/health` | `503` unhealthy/disconnected; restore database for `200` healthy/connected |
| Run seed twice on development database | No duplicate emails; existing IDs, passwords, and active status preserved |
| Seed with `NODE_ENV=production` | Nonzero exit, no seed database writes |

Before deployment, verify HTTPS cookie flags and the actual frontend origin. Bearer-token support was checked with JavaScript syntax checks and in-memory controller/middleware checks using mocked authentication, without test files, live endpoint calls, or database writes.
