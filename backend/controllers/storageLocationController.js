import * as storageLocationService from "../services/storageLocationService.js";
import {
  createStorageLocationSchema,
  updateStorageLocationSchema,
  storageLocationIdSchema,
  listStorageLocationsSchema,
} from "../validators/storageLocationValidators.js";
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

const validateId = (params) => {
  const { error, value } = storageLocationIdSchema.validate(params);
  if (error) {
    throw httpError(400, "INVALID_ID", "Location id must be a valid UUID.");
  }
  return value.id;
};

export const createStorageLocation = async (req, res, next) => {
  try {
    const input = validate(createStorageLocationSchema, req.body);
    res
      .status(201)
      .json(await storageLocationService.createStorageLocation(input));
  } catch (error) {
    next(error);
  }
};

export const listStorageLocations = async (req, res, next) => {
  try {
    validate(listStorageLocationsSchema, req.query);
    res.status(200).json(await storageLocationService.listStorageLocations());
  } catch (error) {
    next(error);
  }
};

export const getStorageLocation = async (req, res, next) => {
  try {
    const id = validateId(req.params);
    res.status(200).json(await storageLocationService.getStorageLocation(id));
  } catch (error) {
    next(error);
  }
};

export const updateStorageLocation = async (req, res, next) => {
  try {
    const id = validateId(req.params);
    const input = validate(updateStorageLocationSchema, req.body);
    res
      .status(200)
      .json(await storageLocationService.updateStorageLocation(id, input));
  } catch (error) {
    next(error);
  }
};

export const deleteStorageLocation = async (req, res, next) => {
  try {
    const id = validateId(req.params);
    await storageLocationService.deleteStorageLocation(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
