import Joi from "joi";

const uuid = Joi.string().uuid();
const expiryDate = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      value.startsWith("0000-") ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error("date.calendar");
    }
    return value;
  })
  .messages({
    "string.pattern.base": "expiryDate must be a date in YYYY-MM-DD format.",
    "date.calendar": "expiryDate must be a valid calendar date in years 0001–9999.",
  });

export const createBatchSchema = Joi.object({
  productId: uuid.required(),
  locationId: uuid.required(),
  quantity: Joi.number().integer().positive().max(2147483647).strict().required(),
  expiryDate: expiryDate.required(),
  manufacturerLot: Joi.string().trim().max(100).allow("", null),
  reason: Joi.string().trim().min(1).max(500),
}).unknown(false).required();

export const updateBatchSchema = Joi.object({
  locationId: uuid,
  expiryDate,
  quantity: Joi.forbidden(),
  quantityChange: Joi.forbidden(),
  type: Joi.forbidden(),
  reason: Joi.forbidden(),
  batchId: Joi.forbidden(),
  performedById: Joi.forbidden(),
  createdAt: Joi.forbidden(),
  stockMovements: Joi.forbidden(),
  initialMovement: Joi.forbidden(),
}).unknown(false).min(1).required().messages({
  "object.min": "Provide at least one of locationId or expiryDate.",
});

export const batchIdSchema = Joi.object({
  id: uuid.required(),
}).unknown(false).required();

export const listBatchesSchema = Joi.object({
  productId: uuid,
  locationId: uuid,
  page: Joi.number().integer().min(1).max(2147483647).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
}).unknown(false).custom((value, helpers) =>
  (value.page - 1) * value.pageSize <= 2147483647
    ? value
    : helpers.error("pagination.offset"),
).messages({
  "pagination.offset": "Requested pagination offset is too large.",
});
