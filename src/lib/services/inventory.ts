import { ObjectId } from "mongodb";
import {
  categoriesCollection,
  inventoryAdjustmentsCollection,
  productsCollection,
} from "@/lib/db/collections";
import type { StockAdjustmentDoc } from "@/lib/db/types";
import type { CurrentUser } from "@/lib/auth/session";
import { ApiError, forbidden, notFound, ValidationError } from "@/lib/errors";
import { runRequiredTransaction } from "@/lib/db/transactions";
import { serializeProduct } from "@/lib/services/products";
import {
  asRecord,
  parseObjectId,
  readInt,
  readString,
} from "@/lib/validation";
import type { Product } from "@/lib/types";

const MAX_STOCK = 1_000_000;

export type AdjustStockResult = {
  product: Product;
  adjustment: {
    id: string;
    productId: string;
    adminUserId: string;
    kind: "manual";
    delta: number;
    beforeStock: number;
    afterStock: number;
    reason: string;
    at: string;
  };
};

/**
 * Applies a manual stock change only when the caller's expected stock is still
 * current. The conditional stock update, durable audit insert, and category
 * lookup all run in one transaction, so a committed stock change always has its
 * audit record and a response failure cannot occur after a committed change.
 */
export async function adjustProductStock(
  productId: string,
  admin: CurrentUser,
  raw: unknown,
): Promise<AdjustStockResult> {
  if (admin.role !== "admin") {
    throw forbidden("Administrator access is required.");
  }

  const body = asRecord(raw);
  const expectedStock = readInt(body.expectedStock, {
    label: "Expected stock",
    min: 0,
    max: MAX_STOCK,
  });
  const delta = readInt(body.delta, {
    label: "Stock adjustment",
    min: -MAX_STOCK,
    max: MAX_STOCK,
  });

  if (delta === 0) {
    throw new ValidationError("Stock adjustment must not be zero.");
  }

  const nextStock = expectedStock + delta;

  if (!Number.isSafeInteger(nextStock) || nextStock < 0) {
    throw new ValidationError("Stock cannot go below zero.");
  }

  if (nextStock > MAX_STOCK) {
    throw new ValidationError(`Stock cannot exceed ${MAX_STOCK}.`);
  }

  const reason = readString(body.reason, {
    label: "Reason",
    min: 3,
    max: 200,
  });
  const id = parseObjectId(productId, "Product ID");
  const auditId = new ObjectId();

  return runRequiredTransaction(async (session) => {
    const at = new Date();
    const updated = await productsCollection.findOneAndUpdate(
      { _id: id, stock: expectedStock },
      {
        $inc: { stock: delta },
        $set: { updatedAt: at },
      },
      { session, returnDocument: "after" },
    );

    if (!updated) {
      const current = await productsCollection.findOne(
        { _id: id },
        { session, projection: { _id: 1 } },
      );

      if (!current) {
        throw notFound("Product not found.");
      }

      throw new ApiError(
        409,
        "Stock changed since this page loaded. Refresh the inventory and try again.",
        "STOCK_CONFLICT",
      );
    }

    const adjustment: StockAdjustmentDoc = {
      _id: auditId,
      productId: id,
      // The route passes the authenticated session user. Any `adminUserId` in
      // the request body is ignored.
      adminUserId: admin.id,
      kind: "manual",
      delta,
      beforeStock: expectedStock,
      afterStock: nextStock,
      reason,
      at,
    };

    await inventoryAdjustmentsCollection.insertOne(adjustment, { session });

    // Keep the response read inside the transaction. If it fails, the stock
    // change and audit record roll back instead of returning a misleading
    // failure after a committed adjustment.
    const category = await categoriesCollection.findOne(
      { _id: updated.categoryId },
      { session },
    );

    return {
      product: serializeProduct(updated, category),
      adjustment: {
        id: adjustment._id.toHexString(),
        productId: adjustment.productId.toHexString(),
        adminUserId: adjustment.adminUserId,
        kind: "manual",
        delta: adjustment.delta,
        beforeStock: adjustment.beforeStock,
        afterStock: adjustment.afterStock,
        reason: adjustment.reason,
        at: adjustment.at.toISOString(),
      },
    };
  });
}
