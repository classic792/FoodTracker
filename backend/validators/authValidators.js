import Joi from "joi";

export const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254)
    .required(),
  password: Joi.string()
    .min(1)
    .custom((value, helpers) =>
      Buffer.byteLength(value, "utf8") <= 72
        ? value
        : helpers.error("password.bytes"),
    )
    .required()
    .messages({ "password.bytes": "Password must not exceed 72 UTF-8 bytes." }),
})
  .unknown(false)
  .required();
