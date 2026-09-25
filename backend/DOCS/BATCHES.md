# Batch Intake and Stock Listing (FET-08)

All endpoints require authentication via the Bearer token or session cookie issued by `POST /api/auth/login`. In Postman, choose **Authorization → Bearer Token** and paste the returned `accessToken`; browser clients using cookies send `credentials: "include"`. See [AUTH.md](./AUTH.md). Responses use `Cache-Control: no-store` and the existing origin policy.

## Endpoints

| Method and path | Accepted input | Success |
| --- | --- | --- |
| `POST /api/batches` | Required `productId`, `locationId`, `quantity`, `expiryDate`; optional `manufacturerLot`, `reason` | `201`, batch detail plus `initialMovement` |
| `GET /api/batches` | Optional query `productId`, `locationId`, `page`, `pageSize` | `200`, `{ items, page, pageSize, total, totalPages }` |
| `GET /api/batches/:id` | UUID path parameter | `200`, batch detail |
| `PATCH /api/batches/:id` | UUID; body with `locationId` and/or `expiryDate` | `200`, updated batch detail |

Batch objects contain `id`, `productId`, `locationId`, `createdById`, `manufacturerLot`, `quantity`, `expiryDate`, `receivedAt`, and `updatedAt`, plus `product: { productCode, name, stockUnit }` and `location: { name }`. Detail, create, and correction also include `createdBy: { id, fullName }`. User email, password hashes, and other user fields are never selected. Only creation includes `initialMovement`; list/detail/correction omit movement history.

`expiryDate` is always a `YYYY-MM-DD` string. Timestamps are ISO-8601 strings; manufacturer lot may be `null`. Single batches are returned without an outer wrapper.

## Validation and intake transaction

- Product/location IDs must be UUIDs referencing existing records. Body IDs are validated before service calls. Missing required fields return `400 VALIDATION_ERROR`; supplied malformed IDs return `400 INVALID_ID`.
- Quantity must be a JSON number, an integer from 1 through 2,147,483,647. Strings such as `"5"`, zero, negatives, fractions, and larger numbers are rejected.
- Expiry must be an exact `YYYY-MM-DD` string describing a real calendar date in years 0001–9999. Past dates are allowed on creation and correction. Datetimes, timezone offsets, surrounding whitespace, year zero, and rollover dates such as `2026-02-30` are rejected. The service constructs UTC midnight for the PostgreSQL DATE column; clients should send the intended calendar date directly, not convert local midnight to an ISO timestamp.
- Optional manufacturer lot is trimmed and limited to 100 characters after trimming. Omission, null, and blank strings become `null`.
- Optional reason is trimmed and must contain 1–500 characters if supplied. Null/blank reasons are rejected. Omission defaults server-side to `Initial stock receipt`.
- POST/PATCH require JSON objects and reject unknown fields. IDs, ownership, and timestamps cannot be supplied by the client.

Every successful POST creates a new batch with a generated UUID. Matching product/location/expiry combinations, including repeated manufacturer lots, are never merged or upserted. Retrying a successful POST creates another receipt; there is no idempotency key in this issue.

An interactive Prisma transaction checks product/location existence and inserts both batch and initial stock movement. The movement has a separate generated UUID, `type: "RECEIPT"`, `quantityChange` equal to the initial positive quantity, and the supplied/default reason. Both `createdById` and `performedById` come from the authenticated user. Either both inserts commit or neither does. A foreign-key failure caused by a concurrent reference deletion becomes `409 REFERENCE_CONFLICT` after rollback.

## Listing and corrections

List filters use product/location UUIDs and combine with AND when both are present. Well-formed but nonexistent filter IDs return an empty result, not a reference-not-found error. Expired and zero-quantity batches are included. Results are ordered by expiry ascending, then ID ascending; each row includes product/location details without follow-up requests.

Pagination matches products: page defaults to 1, page size to 20, maximum page size is 100. Page and computed offset must not exceed 2,147,483,647. Invalid values, repeated parameters, unknown parameters, and excessive page sizes return `400`, not clamped values. An empty result is `{ "items": [], "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }`; out-of-range pages preserve actual totals and return empty items. Rows and count use a Prisma transaction; offset pagination does not freeze inventory across requests.

PATCH validates the path UUID before body validation, then checks batch existence before a supplied replacement location. It updates only location/expiry and explicitly sets `updatedAt`, preserving quantity, product, creator, manufacturer lot, and received time. It writes no movement or audit row. Empty bodies fail.

Supplying `quantity`, `quantityChange`, `type`, `reason`, `batchId`, `performedById`, `createdAt`, `stockMovements`, or `initialMovement` on PATCH rejects the entire request with `400 QUANTITY_NOT_EDITABLE`, even if another body field is also invalid. Other unsupported fields return `400 VALIDATION_ERROR`. Stock adjustment, movement history retrieval, and batch deletion are outside this issue.

## Errors

Errors use `{ "error": { "code": "...", "message": "..." } }`.

| Status | Code | Message / cause |
| --- | --- | --- |
| `400` | `INVALID_ID` | `Batch id must be a valid UUID.`, `Product id must be a valid UUID.`, or `Location id must be a valid UUID.` |
| `400` | `VALIDATION_ERROR` | Field-specific validation message; unknown fields: `Unknown fields are not allowed.`; empty PATCH: `Provide at least one of locationId or expiryDate.` |
| `400` | `QUANTITY_NOT_EDITABLE` | `Quantity can only be changed through the stock adjustment endpoint.` |
| `404` | `BATCH_NOT_FOUND` | `Batch not found.` |
| `404` | `PRODUCT_NOT_FOUND` | `Product not found.` |
| `404` | `LOCATION_NOT_FOUND` | `Storage location not found.` |
| `409` | `REFERENCE_CONFLICT` | `A referenced record is no longer available. Reload and try again.` |
| `400` | `INVALID_JSON` | `Request body must be valid JSON.` |
| `401` | `UNAUTHORIZED` | `Authentication required.` |
| `403` | `ORIGIN_FORBIDDEN` | `Request origin is not allowed.` |
| `404` | `NOT_FOUND` | `Endpoint not found.` |
| `413` | `PAYLOAD_TOO_LARGE` | `Request body is too large.` |
| `500` | `INTERNAL_ERROR` | `An unexpected error occurred.` |

Missing batches on GET/PATCH return `404 BATCH_NOT_FOUND`; update `P2025` maps to the same error. Prisma `P2003` on intake/correction maps to `409 REFERENCE_CONFLICT`. Unexpected database errors retain the shared generic response. Authentication runs before controllers; global origin and JSON parsing middleware still run before authentication.

## Manual examples (not executed)

Use existing product/location IDs and an active staff token. All IDs and timestamps below are illustrative. Set Postman's `baseUrl` to the actual backend URL, such as `http://localhost:5000`, and use JSON bodies with `Content-Type: application/json`.

Create: `POST {{baseUrl}}/api/batches`

```json
{
  "productId": "27e86422-daf3-453a-94be-d6c26cb3cb84",
  "locationId": "520c2fa7-3daa-4e82-a599-6a02c8f45a63",
  "quantity": 12,
  "expiryDate": "2027-03-31",
  "manufacturerLot": "LOT-2026-A"
}
```

Expected `201`:

```json
{
  "id": "8a93c4ef-5264-4d78-bf13-ae357281f241",
  "productId": "27e86422-daf3-453a-94be-d6c26cb3cb84",
  "locationId": "520c2fa7-3daa-4e82-a599-6a02c8f45a63",
  "createdById": "62bf3b9d-6051-4aca-a2a9-0db5cc9a64bb",
  "manufacturerLot": "LOT-2026-A",
  "quantity": 12,
  "expiryDate": "2027-03-31",
  "receivedAt": "2026-09-25T10:00:00.000Z",
  "updatedAt": "2026-09-25T10:00:00.000Z",
  "product": { "productCode": "RICE-001", "name": "Rice", "stockUnit": "bag" },
  "location": { "name": "Shelf A" },
  "createdBy": { "id": "62bf3b9d-6051-4aca-a2a9-0db5cc9a64bb", "fullName": "Alex Morgan" },
  "initialMovement": {
    "id": "fbbdc67c-afcf-43ae-947d-8a4518d8bf61",
    "batchId": "8a93c4ef-5264-4d78-bf13-ae357281f241",
    "performedById": "62bf3b9d-6051-4aca-a2a9-0db5cc9a64bb",
    "type": "RECEIPT",
    "quantityChange": 12,
    "reason": "Initial stock receipt",
    "createdAt": "2026-09-25T10:00:00.000Z"
  }
}
```

Repeating this POST returns another `201` with a different batch ID and movement ID; the original batch remains at quantity 12. Supplying `"reason": "Morning delivery"` stores that reason instead of the default.

List: `GET {{baseUrl}}/api/batches?productId=27e86422-daf3-453a-94be-d6c26cb3cb84&locationId=520c2fa7-3daa-4e82-a599-6a02c8f45a63&page=1&pageSize=20`. With one matching batch, expected `200`:

```json
{
  "items": [{
    "id": "8a93c4ef-5264-4d78-bf13-ae357281f241",
    "productId": "27e86422-daf3-453a-94be-d6c26cb3cb84",
    "locationId": "520c2fa7-3daa-4e82-a599-6a02c8f45a63",
    "createdById": "62bf3b9d-6051-4aca-a2a9-0db5cc9a64bb",
    "manufacturerLot": "LOT-2026-A",
    "quantity": 12,
    "expiryDate": "2027-03-31",
    "receivedAt": "2026-09-25T10:00:00.000Z",
    "updatedAt": "2026-09-25T10:00:00.000Z",
    "product": { "productCode": "RICE-001", "name": "Rice", "stockUnit": "bag" },
    "location": { "name": "Shelf A" }
  }],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1
}
```

Detail: `GET {{baseUrl}}/api/batches/8a93c4ef-5264-4d78-bf13-ae357281f241`. Expected `200` with the complete creation response above except for `initialMovement`, which is absent.

Correct: `PATCH {{baseUrl}}/api/batches/8a93c4ef-5264-4d78-bf13-ae357281f241`

```json
{ "expiryDate": "2026-02-28" }
```

Expected `200`:

```json
{
  "id": "8a93c4ef-5264-4d78-bf13-ae357281f241",
  "productId": "27e86422-daf3-453a-94be-d6c26cb3cb84",
  "locationId": "520c2fa7-3daa-4e82-a599-6a02c8f45a63",
  "createdById": "62bf3b9d-6051-4aca-a2a9-0db5cc9a64bb",
  "manufacturerLot": "LOT-2026-A",
  "quantity": 12,
  "expiryDate": "2026-02-28",
  "receivedAt": "2026-09-25T10:00:00.000Z",
  "updatedAt": "2026-09-25T10:01:00.000Z",
  "product": { "productCode": "RICE-001", "name": "Rice", "stockUnit": "bag" },
  "location": { "name": "Shelf A" },
  "createdBy": { "id": "62bf3b9d-6051-4aca-a2a9-0db5cc9a64bb", "fullName": "Alex Morgan" }
}
```

To correct location, send `{ "locationId": "<existing-location-uuid>" }`, optionally with expiry. The returned location ID/name change; other fields are preserved except `updatedAt`. No movement is added.

Sending `{ "quantity": 20 }` on PATCH returns `400`:

```json
{ "error": { "code": "QUANTITY_NOT_EDITABLE", "message": "Quantity can only be changed through the stock adjustment endpoint." } }
```

`GET /api/batches/not-a-uuid` returns `400`:

```json
{ "error": { "code": "INVALID_ID", "message": "Batch id must be a valid UUID." } }
```

A well-formed absent batch ID returns `404`:

```json
{ "error": { "code": "BATCH_NOT_FOUND", "message": "Batch not found." } }
```

## Manual verification checklist

- Valid Bearer and cookie sessions work on all four endpoints; missing, invalid, expired, and inactive-user authentication fails. Verify no-store headers and shared origin/JSON errors.
- Each intake creates distinct batch/receipt IDs, both attributed to the authenticated staff member. Reject client ownership fields. Repeated identical deliveries remain separate.
- In a controlled development environment, force receipt insertion to fail and confirm neither batch nor receipt persists. Verify successful intake creates exactly one of each.
- Check quantity 1 and 2,147,483,647; reject zero, negatives, decimals, strings, null, and overflow. Check lot/reason limits, normalization, omitted reason default, and null/blank reason rejection.
- Accept leap day `2028-02-29`; reject `2026-02-29`, February 30, year zero, and ISO timestamps with or without offsets. Confirm the same calendar date is stored/returned regardless of client timezone, including past dates and years 0001/9999.
- Check all/product/location/combined filters, expired and zero-quantity inclusion, deterministic expiry/ID ordering, empty results, out-of-range pages, defaults, maximum page size, excessive offsets, and unknown/repeated query parameters.
- Detail/create/correction contain only safe creator fields. List omits creator expansion. Only create contains initial movement; no response includes movement history.
- Location-only, expiry-only, and combined corrections preserve quantity/product/creator/lot/received time, advance `updatedAt`, and preserve movement count. Empty/unknown bodies fail. Every prohibited movement field returns `QUANTITY_NOT_EDITABLE`.
- Check malformed IDs versus absent UUIDs, absent product/location on intake, missing batch before missing replacement location, `P2025` update races, and foreign-key race translation to `REFERENCE_CONFLICT` with no partial intake.

No seed scripts, test files, schema changes, or migrations are included. Implementation checks use JavaScript syntax checks, in-memory validation, and diff review; live endpoint/database verification is left to manual testing.
