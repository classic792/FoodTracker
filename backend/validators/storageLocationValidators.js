import Joi from "joi";

const name = Joi.string().trim().min(1).max(100);
const description = Joi.string().trim().allow("", null);

export const createStorageLocationSchema = Joi.object({
  name: name.required(),
  description,
})
  .unknown(false)
  .required();

export const updateStorageLocationSchema = Joi.object({
  name,
  description,
})
  .unknown(false)
  .min(1)
  .required()
  .messages({
    "object.min": "Provide at least one of name or description.",
  });

export const storageLocationIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
})
  .unknown(false)
  .required();

export const listStorageLocationsSchema = Joi.object({})
  .unknown(false)
  .required();
