import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";
import { httpError } from "../utils/errors.js";

const storageLocationSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

const notFound = () =>
  httpError(404, "LOCATION_NOT_FOUND", "Storage location not found.");
const duplicateName = () =>
  httpError(
    409,
    "DUPLICATE_LOCATION_NAME",
    "A storage location with this name already exists.",
  );
const normalizeDescription = (value) => value?.trim() || null;

const isDuplicateName = (error) => {
  if (error.code !== "P2002") return false;
  // Prisma's PostgreSQL adapter reports an index; other engines report target fields.
  const constraint = error.meta?.driverAdapterError?.cause?.constraint;
  const target = error.meta?.target ?? constraint?.fields ?? constraint?.index;
  const names = Array.isArray(target) ? target : [target];
  return names.some((name) =>
    ["name", "storage_locations_name_key"].includes(name),
  );
};

export const createStorageLocation = async ({ name, description }) => {
  try {
    return await prisma.storageLocation.create({
      data: {
        id: randomUUID(),
        name,
        description: normalizeDescription(description),
      },
      select: storageLocationSelect,
    });
  } catch (error) {
    if (isDuplicateName(error)) throw duplicateName();
    throw error;
  }
};

export const listStorageLocations = async () => {
  const items = await prisma.storageLocation.findMany({
    select: { id: true, name: true, description: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return { items };
};

export const getStorageLocation = async (id) => {
  const location = await prisma.storageLocation.findUnique({
    where: { id },
    select: storageLocationSelect,
  });
  if (!location) throw notFound();
  return location;
};

export const updateStorageLocation = async (id, input) => {
  const data = { updatedAt: new Date() };
  if (Object.hasOwn(input, "name")) data.name = input.name;
  if (Object.hasOwn(input, "description"))
    data.description = normalizeDescription(input.description);
  try {
    return await prisma.storageLocation.update({
      where: { id },
      data,
      select: storageLocationSelect,
    });
  } catch (error) {
    if (isDuplicateName(error)) throw duplicateName();
    if (error.code === "P2025") throw notFound();
    throw error;
  }
};

export const deleteStorageLocation = async (id) => {
  try {
    await prisma.storageLocation.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    if (error.code === "P2003") {
      throw httpError(
        409,
        "LOCATION_IN_USE",
        "This location has batches on record and cannot be deleted.",
      );
    }
    if (error.code === "P2025") throw notFound();
    throw error;
  }
};
