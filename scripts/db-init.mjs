import { ensureIndexes, getDatabase, printDatabaseName } from "./db-utils.mjs";

const { client, db } = getDatabase();

try {
  await db.command({ ping: 1 });
  printDatabaseName(db);
  await ensureIndexes(db);

  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const names = collections.map((collection) => collection.name).sort();

  console.log("Indexes are ready.");
  console.log(`Collections (${names.length}): ${names.join(", ")}`);
  console.log("This script is repeat-safe and does not delete or reset data.");
} catch (error) {
  console.error("Database initialization failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
