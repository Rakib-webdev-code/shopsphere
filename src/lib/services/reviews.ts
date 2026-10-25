import { ObjectId } from "mongodb";
import {
  categoriesCollection,
  ordersCollection,
  productsCollection,
  reviewsCollection,
} from "@/lib/db/collections";
import type { ReviewDoc } from "@/lib/db/types";
import { conflict, forbidden, notFound, ValidationError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/auth/session";
import type { Review } from "@/lib/types";
import { recalculateProductRating } from "@/lib/services/products";
import {
  asRecord,
  parseObjectId,
  readInt,
  readString,
} from "@/lib/validation";

function serializeReview(
  review: ReviewDoc,
  currentUserId?: string,
): Review {
  return {
    id: review._id.toHexString(),
    productId: review.productId.toHexString(),
    authorName: review.authorName,
    rating: review.rating,
    title: review.title,
    body: review.body,
    verifiedPurchase: Boolean(review.verifiedPurchase),
    isOwn: Boolean(currentUserId && review.userId === currentUserId),
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export async function listProductReviews(
  productId: ObjectId,
  currentUserId?: string,
  limit = 20,
): Promise<Review[]> {
  const reviews = await reviewsCollection
    .find({ productId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .toArray();

  return reviews.map((review) => serializeReview(review, currentUserId));
}

export async function getReviewForUser(userId: string, reviewId: string) {
  const review = await reviewsCollection.findOne({
    _id: parseObjectId(reviewId, "Review ID"),
    userId,
  });

  return review ? serializeReview(review, userId) : null;
}

type ReviewFields = {
  rating: number;
  title: string;
  body: string;
};

function parseReviewFields(rawValue: unknown): ReviewFields {
  const raw = asRecord(rawValue);

  return {
    rating: readInt(raw.rating, { label: "Rating", min: 1, max: 5 }),
    title: readString(raw.title ?? "", {
      label: "Review title",
      min: 0,
      max: 120,
      optional: true,
    }),
    body: readString(raw.body, {
      label: "Review",
      min: 10,
      max: 2_000,
    }),
  };
}

export async function createReview(
  user: CurrentUser,
  productSlug: string,
  raw: unknown,
): Promise<Review> {
  const product = await productsCollection.findOne({
    slug: productSlug,
    active: true,
  });

  if (!product) {
    throw notFound("Product not found.");
  }

  const category = await categoriesCollection.findOne(
    { _id: product.categoryId },
    { projection: { active: 1 } },
  );

  if (category && !category.active) {
    throw conflict("This product category is no longer available.");
  }

  const existing = await reviewsCollection.findOne({
    productId: product._id,
    userId: user.id,
  });

  if (existing) {
    throw conflict("You have already reviewed this product.");
  }

  const fields = parseReviewFields(raw);
  const completedOrder = await ordersCollection.findOne({
    userId: user.id,
    status: "delivered",
    "items.productId": product._id,
  });
  const now = new Date();
  const document: ReviewDoc = {
    _id: new ObjectId(),
    productId: product._id,
    userId: user.id,
    authorName: user.name,
    ...fields,
    verifiedPurchase: Boolean(completedOrder),
    orderId: completedOrder?._id ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await reviewsCollection.insertOne(document);
  await recalculateProductRating(product._id);

  return serializeReview(document, user.id);
}

export async function updateReview(
  user: CurrentUser,
  reviewId: string,
  raw: unknown,
): Promise<Review> {
  const id = parseObjectId(reviewId, "Review ID");
  const existing = await reviewsCollection.findOne({ _id: id });

  if (!existing) {
    throw notFound("Review not found.");
  }

  if (existing.userId !== user.id) {
    throw forbidden("You can only edit your own review.");
  }

  const fields = parseReviewFields(raw);
  const updatedAt = new Date();

  await reviewsCollection.updateOne(
    { _id: id, userId: user.id },
    { $set: { ...fields, updatedAt } },
  );

  await recalculateProductRating(existing.productId);

  const updated = await reviewsCollection.findOne({ _id: id });

  if (!updated) {
    throw notFound("Review not found.");
  }

  return serializeReview(updated, user.id);
}

export async function deleteReview(
  user: CurrentUser,
  reviewId: string,
): Promise<void> {
  const id = parseObjectId(reviewId, "Review ID");
  const existing = await reviewsCollection.findOne({ _id: id });

  if (!existing) {
    throw notFound("Review not found.");
  }

  if (existing.userId !== user.id) {
    throw forbidden("You can only delete your own review.");
  }

  const result = await reviewsCollection.deleteOne({
    _id: id,
    userId: user.id,
  });

  if (result.deletedCount !== 1) {
    throw new ValidationError("The review could not be deleted.");
  }

  await recalculateProductRating(existing.productId);
}
