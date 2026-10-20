import { ObjectId } from "mongodb";
import { getDatabase, printDatabaseName } from "./db-utils.mjs";

const identifier = process.argv[2]?.trim();

if (!identifier) {
  console.error(
    "Usage: npm run admin:promote -- <user-email-or-id>\n" +
      "This script never creates users and must be run manually by the project owner.",
  );
  process.exit(1);
}

const { client, db } = getDatabase();

try {
  await db.command({ ping: 1 });
  printDatabaseName(db);

  const filter = identifier.includes("@")
    ? { email: identifier.toLowerCase() }
    : ObjectId.isValid(identifier)
      ? { _id: new ObjectId(identifier) }
      : null;

  if (!filter) {
    throw new Error("Provide a valid email address or MongoDB ObjectId.");
  }

  const user = await db.collection("user").findOne(filter, {
    projection: { name: 1, email: 1, role: 1 },
  });

  if (!user) {
    throw new Error(
      "No Better Auth user matched that identifier. Sign up normally first; this script never creates accounts.",
    );
  }

  if (user.role === "admin") {
    console.log(`${user.email} already has the admin role. No changes made.`);
  } else {
    await db.collection("user").updateOne(
      { _id: user._id },
      { $set: { role: "admin", updatedAt: new Date() } },
    );
    console.log(`Granted admin role to ${user.email} (${user.name}).`);
  }

  console.log(
    "Sign out and back in if the admin link does not appear immediately. Role checks are always re-read from MongoDB on the server.",
  );
} catch (error) {
  console.error("Admin promotion failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
