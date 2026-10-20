import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is not set. Add it to your environment file.");
}

// Reuse one client across dev hot reloads so connections are not leaked.
const globalForMongo = globalThis as unknown as {
  mongoClient?: MongoClient;
};

const client = globalForMongo.mongoClient ?? new MongoClient(mongoUri);

if (process.env.NODE_ENV !== "production") {
  globalForMongo.mongoClient = client;
}

export const mongoClient = client;
export const db = client.db(process.env.MONGODB_DB ?? "shopsphere");
