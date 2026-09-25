import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";
import { httpError } from "../utils/errors.js";

const batchSelect = {
  id: true,
  productId: true,
  locationId: true,
  createdById: true,
  manufacturerLot: true,
  quantity: true,
  expiryDate: true,
  receivedAt: true,
  updatedAt: true,
  product: { select: { productCode: true, name: true, stockUnit: true } },
  location: { select: { name: true } },
};
const batchDetailSelect = {
  ...batchSelect,
  createdBy: { select: { id: true, fullName: true } },
};
const movementSelect = {
  id: true,
  batchId: true,
  performedById: true,
  type: true,
  quantityChange: true,
  reason: true,
  createdAt: true,
};

const notFound = () => httpError(404, "BATCH_NOT_FOUND", "Batch not found.");
const referenceConflict = () => httpError(
  409,
  "REFERENCE_CONFLICT",
  "A referenced record is no longer available. Reload and try again.",
);
const toExpiryDate = (value) => new Date(`${value}T00:00:00.000Z`);
const serializeBatch = (batch) => ({
  ...batch,
  expiryDate: batch.expiryDate.toISOString().slice(0, 10),
});

const requireLocation = async (tx, id) => {
  const location = await tx.storageLocation.findUnique({
    where: { id }, select: { id: true },
  });
  if (!location) {
    throw httpError(404, "LOCATION_NOT_FOUND", "Storage location not found.");
  }
};

export const createBatch = async (input, userId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: input.productId }, select: { id: true },
      });
      if (!product) throw httpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
      await requireLocation(tx, input.locationId);
      const batch = await tx.batch.create({
        data: {
          id: randomUUID(),
          productId: input.productId,
          locationId: input.locationId,
          createdById: userId,
          manufacturerLot: input.manufacturerLot?.trim() || null,
          quantity: input.quantity,
          expiryDate: toExpiryDate(input.expiryDate),
        },
        select: batchDetailSelect,
      });
      const initialMovement = await tx.stockMovement.create({
        data: {
          id: randomUUID(),
          batchId: batch.id,
          performedById: userId,
          type: "RECEIPT",
          quantityChange: input.quantity,
          reason: input.reason === undefined ? "Initial stock receipt" : input.reason,
        },
        select: movementSelect,
      });
      return { ...serializeBatch(batch), initialMovement };
    });
  } catch (error) {
    if (error.code === "P2003") throw referenceConflict();
    throw error;
  }
};

export const listBatches = async ({ productId, locationId, page, pageSize }) => {
  const where = {};
  if (productId !== undefined) where.productId = productId;
  if (locationId !== undefined) where.locationId = locationId;
  const [items, total] = await prisma.$transaction([
    prisma.batch.findMany({
      where,
      select: batchSelect,
      orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.batch.count({ where }),
  ]);
  return {
    items: items.map(serializeBatch),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
};

export const getBatch = async (id) => {
  const batch = await prisma.batch.findUnique({
    where: { id }, select: batchDetailSelect,
  });
  if (!batch) throw notFound();
  return serializeBatch(batch);
};

export const updateBatch = async (id, input) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.batch.findUnique({
        where: { id }, select: { id: true },
      });
      if (!existing) throw notFound();
      const data = { updatedAt: new Date() };
      if (Object.hasOwn(input, "locationId")) {
        await requireLocation(tx, input.locationId);
        data.locationId = input.locationId;
      }
      if (Object.hasOwn(input, "expiryDate")) {
        data.expiryDate = toExpiryDate(input.expiryDate);
      }
      const batch = await tx.batch.update({
        where: { id }, data, select: batchDetailSelect,
      });
      return serializeBatch(batch);
    });
  } catch (error) {
    if (error.code === "P2025") throw notFound();
    if (error.code === "P2003") throw referenceConflict();
    throw error;
  }
};
