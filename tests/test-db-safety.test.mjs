import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIsolatedDatabase,
  dropTestDatabase,
} from "./support/test-db.mjs";

test("database cleanup requires the exact expected isolated database", async () => {
  let dropped = false;
  const db = {
    databaseName: "ss_phase1_test_expected",
    async dropDatabase() {
      dropped = true;
    },
  };

  await assert.rejects(
    dropTestDatabase(db, "ss_phase1_test_different"),
    /Refusing to drop unexpected test database/,
  );
  assert.equal(dropped, false);

  await dropTestDatabase(db, "ss_phase1_test_expected");
  assert.equal(dropped, true);
});

test("database cleanup refuses a non-test database", async () => {
  let dropped = false;
  const db = {
    databaseName: "shopsphere",
    async dropDatabase() {
      dropped = true;
    },
  };

  assert.throws(() => assertIsolatedDatabase(db.databaseName), /Refusing to run tests/);
  await assert.rejects(
    dropTestDatabase(db, "shopsphere"),
    /Refusing to run tests/,
  );
  assert.equal(dropped, false);
});
