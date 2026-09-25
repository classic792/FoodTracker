# Development staff accounts

These are fictional, publicly documented development credentials. Never seed them into a production database. The command refuses `NODE_ENV=production`; confirm your `DATABASE_URL` points to a development database before running it.

| Name           | Email                        | Password                | Active |
| -------------- | ---------------------------- | ----------------------- | ------ |
| Alex Morgan    | alex@foodtracker.example     | Alex-Dev-Only-2026!     | Yes    |
| Sam Rivera     | sam@foodtracker.example      | Sam-Dev-Only-2026!      | Yes    |
| Inactive Staff | inactive@foodtracker.example | Inactive-Dev-Only-2026! | No     |

From `backend`, after configuring `.env` and applying the existing development migrations:

```powershell
npx prisma generate
npm run seed
```

`npm run seed` invokes `prisma db seed`, configured to run `prisma/seed.js`. It does not run automatically on server startup. The script uses the shared Prisma client, generates each new UUID with `crypto.randomUUID()`, hashes passwords using bcrypt cost 12, and inserts missing emails only. Existing accounts retain their UUIDs, names, passwords, and active status, even if they differ from this table. Concurrent duplicate inserts are skipped. The script disconnects Prisma and closes the shared pool in `finally`; failures exit nonzero without printing credentials or database error details.

No user fields, models, or migrations were added. If an account already exists with different credentials, this command intentionally does not reset it. Inactive Staff must receive the same generic `401 INVALID_CREDENTIALS` response as an unknown email or wrong password.
