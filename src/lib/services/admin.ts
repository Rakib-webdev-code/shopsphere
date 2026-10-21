import type { Filter } from "mongodb";
import {
  categoriesCollection,
  ordersCollection,
  productsCollection,
  usersCollection,
} from "@/lib/db/collections";
import type { ProductDoc } from "@/lib/db/types";
import type {
  AdminStats,
  CustomerSummary,
  LowStockOverview,
  Product,
} from "@/lib/types";
import { serializeProducts } from "@/lib/services/products";
import { recoverPendingInventoryReleases } from "@/lib/services/orders";
import { escapeRegex } from "@/lib/validation";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";

export async function getAdminStats(): Promise<AdminStats> {
  // Opportunistic, idempotent repair for cancellations that were claimed but
  // crashed before restoring inventory. Runs before the stock counts are read.
  await recoverPendingInventoryReleases(5).catch((error: unknown) => {
    console.error("[admin] Inventory recovery check failed:", error);
  });

  const [
    activeProducts,
    inactiveProducts,
    activeCategories,
    lowStockProducts,
    totalOrders,
    openOrders,
    cancelledOrders,
    valueResult,
    customerCount,
    recentOrders,
  ] = await Promise.all([
    productsCollection.countDocuments({ active: true }),
    productsCollection.countDocuments({ active: false }),
    categoriesCollection.countDocuments({ active: true }),
    productsCollection.countDocuments({
      active: true,
      stock: { $lte: LOW_STOCK_THRESHOLD },
    }),
    ordersCollection.countDocuments({}),
    ordersCollection.countDocuments({
      status: { $in: ["pending", "confirmed", "processing"] },
    }),
    ordersCollection.countDocuments({ status: "cancelled" }),
    ordersCollection
      .aggregate<{ _id: null; total: number }>([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$totalCents" } } },
      ])
      .toArray(),
    usersCollection.countDocuments({}),
    ordersCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
  ]);

  return {
    activeProducts,
    inactiveProducts,
    activeCategories,
    lowStockProducts,
    totalOrders,
    openOrders,
    cancelledOrders,
    grossOrderValueCents: valueResult[0]?.total ?? 0,
    customerCount,
    recentOrders: recentOrders.map((order) => ({
      id: order._id.toHexString(),
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
      totalCents: order.totalCents,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

export async function listInventory(options: {
  query?: string;
  lowStock?: boolean;
} = {}): Promise<Product[]> {
  const filter: Filter<ProductDoc> = {};

  if (options.query?.trim()) {
    const regex = new RegExp(escapeRegex(options.query.trim()), "i");
    filter.$or = [{ name: regex }, { sku: regex }];
  }

  if (options.lowStock) {
    filter.stock = { $lte: LOW_STOCK_THRESHOLD };
  }

  const products = await productsCollection
    .find(filter)
    .sort({ stock: 1, name: 1 })
    .limit(200)
    .toArray();

  return serializeProducts(products);
}

export async function countLowStockProducts() {
  const filter: Filter<ProductDoc> = {
    active: true,
    stock: { $lte: LOW_STOCK_THRESHOLD },
  };
  const [total, outOfStock] = await Promise.all([
    productsCollection.countDocuments(filter),
    productsCollection.countDocuments({ active: true, stock: 0 }),
  ]);

  return {
    threshold: LOW_STOCK_THRESHOLD,
    total,
    outOfStock,
  };
}

export async function listLowStockAlerts(limit = 8): Promise<LowStockOverview> {
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  const filter: Filter<ProductDoc> = {
    active: true,
    stock: { $lte: LOW_STOCK_THRESHOLD },
  };
  const [products, counts] = await Promise.all([
    productsCollection
      .find(filter, {
        projection: { name: 1, sku: 1, stock: 1, active: 1 },
      })
      .sort({ stock: 1, name: 1 })
      .limit(safeLimit)
      .toArray(),
    countLowStockProducts(),
  ]);

  return {
    ...counts,
    items: products.map((product) => ({
      id: product._id.toHexString(),
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      active: Boolean(product.active),
    })),
  };
}

export async function listCustomerSummaries(): Promise<CustomerSummary[]> {
  const [users, orderStats] = await Promise.all([
    usersCollection
      .find({}, { projection: { name: 1, email: 1, role: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray(),
    ordersCollection
      .aggregate<{
        _id: string;
        orderCount: number;
        totalSpentCents: number;
        lastOrderAt: Date;
      }>([
        {
          $group: {
            _id: "$userId",
            orderCount: { $sum: 1 },
            totalSpentCents: {
              $sum: {
                $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$totalCents"],
              },
            },
            lastOrderAt: { $max: "$createdAt" },
          },
        },
      ])
      .toArray(),
  ]);

  const statsMap = new Map(orderStats.map((entry) => [entry._id, entry]));

  return users
    .map((user) => {
      const stats = statsMap.get(user._id.toHexString());

      return {
        id: user._id.toHexString(),
        name: user.name,
        email: user.email,
        role: user.role === "admin" ? "admin" : "customer",
        orderCount: stats?.orderCount ?? 0,
        totalSpentCents: stats?.totalSpentCents ?? 0,
        lastOrderAt: stats?.lastOrderAt
          ? stats.lastOrderAt.toISOString()
          : null,
        createdAt: user.createdAt.toISOString(),
      } satisfies CustomerSummary;
    })
    .sort((a, b) => {
      if (a.lastOrderAt && b.lastOrderAt) {
        return b.lastOrderAt.localeCompare(a.lastOrderAt);
      }

      if (a.lastOrderAt) return -1;
      if (b.lastOrderAt) return 1;
      return a.name.localeCompare(b.name);
    });
}
