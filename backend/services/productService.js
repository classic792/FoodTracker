import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";
import { httpError } from "../utils/errors.js";

const productSelect = {
  id: true,
  productCode: true,
  name: true,
  stockUnit: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

const notFound = () =>
  httpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
const normalizeDescription = (value) => value?.trim() || null;

const isDuplicateCode = (error) => {
  if (error.code !== "P2002") return false;
  // Prisma's PostgreSQL adapter reports an index; other engines report target fields.
  const constraint = error.meta?.driverAdapterError?.cause?.constraint;
  const target = error.meta?.target ?? constraint?.fields ?? constraint?.index;
  const names = Array.isArray(target) ? target : [target];
  return names.some((name) =>
    ["productCode", "product_code", "products_product_code_key"].includes(name),
  );
};

export const createProduct = async ({
  productCode,
  name,
  stockUnit,
  description,
}) => {
  try {
    return await prisma.product.create({
      data: {
        id: randomUUID(),
        productCode,
        name,
        stockUnit,
        description: normalizeDescription(description),
      },
      select: productSelect,
    });
  } catch (error) {
    if (isDuplicateCode(error)) {
      throw httpError(
        409,
        "DUPLICATE_PRODUCT_CODE",
        "A product with this code already exists.",
      );
    }
    throw error;
  }
};

export const listProducts = async ({ q, page, pageSize }) => {
  const where = q
    ? {
        OR: [
          { productCode: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: productSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
};

export const getProduct = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    select: productSelect,
  });
  if (!product) throw notFound();
  return product;
};

export const updateProduct = async (id, input) => {
  for (const field of ["productCode", "stockUnit"]) {
    if (Object.hasOwn(input, field)) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        `${field} cannot be changed after creation.`,
      );
    }
  }
  const data = { updatedAt: new Date() };
  if (Object.hasOwn(input, "name")) data.name = input.name;
  if (Object.hasOwn(input, "description"))
    data.description = normalizeDescription(input.description);
  try {
    return await prisma.product.update({
      where: { id },
      data,
      select: productSelect,
    });
  } catch (error) {
    if (error.code === "P2025") throw notFound();
    throw error;
  }
};

export const deleteProduct = async (id) => {
  try {
    await prisma.product.delete({ where: { id }, select: { id: true } });
  } catch (error) {
    if (error.code === "P2003") {
      throw httpError(
        409,
        "PRODUCT_IN_USE",
        "This product has batches on record and cannot be deleted.",
      );
    }
    if (error.code === "P2025") throw notFound();
    throw error;
  }
};
