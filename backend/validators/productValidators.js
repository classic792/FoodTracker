import Joi from "joi";

const description = Joi.string().trim().allow("", null);

export const createProductSchema = Joi.object({
  productCode: Joi.string().trim().max(50).required(),
  name: Joi.string().trim().max(150).required(),
  stockUnit: Joi.string().trim().max(30).required(),
  description,
}).unknown(false).required();

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().max(150),
  description,
  productCode: Joi.forbidden().messages({
    "any.unknown": "productCode cannot be changed after creation.",
  }),
  stockUnit: Joi.forbidden().messages({
    "any.unknown": "stockUnit cannot be changed after creation.",
  }),
}).unknown(false).min(1).required().messages({
  "object.min": "Provide at least one of name or description.",
});

export const productIdSchema = Joi.object({
  id: Joi.string().pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .required().messages({ "string.pattern.base": "id must be a valid UUID." }),
}).unknown(false).required();

export const listProductsSchema = Joi.object({
  q: Joi.string().trim().allow(""),
  page: Joi.number().integer().min(1).max(2147483647).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
}).unknown(false).custom((value, helpers) =>
  (value.page - 1) * value.pageSize <= 2147483647
    ? value
    : helpers.error("pagination.offset"),
).messages({
  "pagination.offset": "Requested pagination offset is too large.",
});
