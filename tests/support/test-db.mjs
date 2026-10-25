import { randomBytes } from "node:crypto";

// MongoDB database names are limited to 38 bytes on Atlas.
export const TEST_DB_PREFIX = "ss_phase1_test_";

/**
 * Points the application modules at a brand-new throwaway database in the
 * configured cluster. The real `shopsphere` database is never selected.
 */
export function configureTestDatabase({ transactions = "off" } = {}) {
  if (!process.env.MONGODB_URI) {
    return null;
  }

  const name = `${TEST_DB_PREFIX}${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  process.env.MONGODB_DB = name;

  if (transactions === "off") {
    // Exercise the standalone-MongoDB compensation path deliberately.
    process.env.MONGODB_TRANSACTIONS = "off";
  } else {
    // Let the driver detect the cluster (a replica set enables transactions).
    delete process.env.MONGODB_TRANSACTIONS;
  }

  return name;
}

export function assertIsolatedDatabase(databaseName) {
  if (!databaseName?.startsWith(TEST_DB_PREFIX)) {
    throw new Error(
      `Refusing to run tests against non-test database "${databaseName}".`,
    );
  }
}

export async function dropTestDatabase(db, expectedDatabaseName) {
  assertIsolatedDatabase(db.databaseName);
  if (!expectedDatabaseName || db.databaseName !== expectedDatabaseName) {
    throw new Error(
      `Refusing to drop unexpected test database "${db.databaseName}".`,
    );
  }
  await db.dropDatabase();
}
