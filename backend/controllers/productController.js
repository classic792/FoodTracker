import * as productService from "../services/productService.js";
import {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
  listProductsSchema,
} from "../validators/productValidators.js";
import { httpError } from "../utils/errors.js";

const validate = (schema, input) => {
  const { error, value } = schema.validate(input);
  if (error) {
    const detail = error.details[0];
    const message =
      detail.type === "object.unknown"
        ? "Unknown fields are not allowed."
        : detail.message;
    throw httpError(400, "VALIDATION_ERROR", message);
  }
  return value;
};

export const createProduct = async (req, res, next) => {
  try {
    const input = validate(createProductSchema, req.body);
    res.status(201).json(await productService.createProduct(input));
  } catch (error) {
    next(error);
  }
};

export const listProducts = async (req, res, next) => {
  try {
    const query = validate(listProductsSchema, req.query);
    res.status(200).json(await productService.listProducts(query));
  } catch (error) {
    next(error);
  }
};

export const getProduct = async (req, res, next) => {
  try {
    const { id } = validate(productIdSchema, req.params);
    res.status(200).json(await productService.getProduct(id));
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { id } = validate(productIdSchema, req.params);
    const input = validate(updateProductSchema, req.body);
    res.status(200).json(await productService.updateProduct(id, input));
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = validate(productIdSchema, req.params);
    await productService.deleteProduct(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
