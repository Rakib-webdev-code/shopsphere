import assert from "node:assert/strict";
import test from "node:test";
import {
  LOW_STOCK_THRESHOLD,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
} from "../src/lib/constants.ts";

const statuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

test("order status labels cover every status", () => {
  assert.deepEqual(Object.keys(ORDER_STATUS_LABELS).sort(), [...statuses].sort());

  for (const status of statuses) {
    assert.equal(typeof ORDER_STATUS_LABELS[status], "string");
    assert.ok(ORDER_STATUS_LABELS[status].length > 0);
  }
});

test("valid fulfillment transitions are allowed", () => {
  assert.ok(ORDER_STATUS_TRANSITIONS.pending.includes("confirmed"));
  assert.ok(ORDER_STATUS_TRANSITIONS.confirmed.includes("processing"));
  assert.ok(ORDER_STATUS_TRANSITIONS.processing.includes("shipped"));
  assert.ok(ORDER_STATUS_TRANSITIONS.shipped.includes("delivered"));
});

test("invalid fulfillment transitions are rejected by the transition map", () => {
  assert.ok(!ORDER_STATUS_TRANSITIONS.pending.includes("shipped"));
  assert.ok(!ORDER_STATUS_TRANSITIONS.pending.includes("delivered"));
  assert.ok(!ORDER_STATUS_TRANSITIONS.delivered.includes("cancelled"));
  assert.ok(!ORDER_STATUS_TRANSITIONS.cancelled.includes("confirmed"));
  assert.ok(!ORDER_STATUS_TRANSITIONS.shipped.includes("cancelled"));
  assert.deepEqual(ORDER_STATUS_TRANSITIONS.delivered, []);
  assert.deepEqual(ORDER_STATUS_TRANSITIONS.cancelled, []);
});

test("only pre-shipment statuses can be cancelled", () => {
  assert.ok(ORDER_STATUS_TRANSITIONS.pending.includes("cancelled"));
  assert.ok(ORDER_STATUS_TRANSITIONS.confirmed.includes("cancelled"));
  assert.ok(ORDER_STATUS_TRANSITIONS.processing.includes("cancelled"));
  assert.ok(!ORDER_STATUS_TRANSITIONS.shipped.includes("cancelled"));
  assert.ok(!ORDER_STATUS_TRANSITIONS.delivered.includes("cancelled"));
});

test("the low-stock threshold is a positive whole number", () => {
  assert.ok(Number.isInteger(LOW_STOCK_THRESHOLD));
  assert.ok(LOW_STOCK_THRESHOLD > 0);
});
