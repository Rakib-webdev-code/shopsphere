import {
  MongoNetworkError,
  MongoServerError,
  MongoServerSelectionError,
  type ClientSession,
} from "mongodb";
import { db, mongoClient } from "@/lib/mongodb";
import { ApiError } from "@/lib/errors";

let transactionSupport: boolean | null = null;

/**
 * Automatic detection is correct for replica sets and sharded clusters. The
 * override exists for deployments where detection is wrong and for tests that
 * need to exercise the standalone-MongoDB compensation path on a replica set.
 * `MONGODB_TRANSACTIONS=off` disables transactions; `on` forces them.
 */
function forcedTransactionSupport(): boolean | null {
  const value = process.env.MONGODB_TRANSACTIONS?.trim().toLowerCase();

  if (value === "off" || value === "false" || value === "disabled" || value === "0") {
    return false;
  }

  if (value === "on" || value === "true" || value === "enabled" || value === "1") {
    return true;
  }

  return null;
}

function transactionsUnavailable() {
  return new ApiError(
    503,
    "This operation requires MongoDB transactions, which are currently unavailable.",
    "TRANSACTIONS_UNAVAILABLE",
  );
}

function isRuntimeTransactionUnavailable(error: unknown) {
  return (
    (error instanceof MongoServerError && error.code === 20) ||
    error instanceof MongoNetworkError ||
    error instanceof MongoServerSelectionError
  );
}

export async function supportsTransactions(): Promise<boolean> {
  if (transactionSupport !== null) {
    return transactionSupport;
  }

  const forced = forcedTransactionSupport();

  if (forced !== null) {
    transactionSupport = forced;
    return forced;
  }

  let hello: { setName?: string; msg?: string };

  try {
    hello = (await db.admin().command({ hello: 1 })) as {
      setName?: string;
      msg?: string;
    };
  } catch {
    // A transient detection failure must not permanently disable transactions
    // for the lifetime of the process. Fail closed for this request and retry
    // detection on the next call.
    return false;
  }

  transactionSupport = Boolean(hello.setName || hello.msg === "isdbgrid");
  return transactionSupport;
}

export async function runOptionalTransaction<T>(
  work: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  if (!(await supportsTransactions())) {
    return work();
  }

  const session = mongoClient.startSession();

  try {
    let result: T | undefined;

    await session.withTransaction(
      async () => {
        result = await work(session);
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
      },
    );

    if (result === undefined) {
      throw new Error("The transaction completed without a result.");
    }

    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Runs work in a transaction or fails before any write when transactions are
 * unavailable. Unlike `runOptionalTransaction`, this never falls back to
 * non-transactional writes.
 */
export async function runRequiredTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  if (!(await supportsTransactions())) {
    throw transactionsUnavailable();
  }

  let session: ClientSession;

  try {
    session = mongoClient.startSession();
  } catch {
    throw transactionsUnavailable();
  }

  try {
    let result: T | undefined;

    try {
      await session.withTransaction(
        async () => {
          result = await work(session);
        },
        {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
        },
      );
    } catch (error) {
      if (isRuntimeTransactionUnavailable(error)) {
        if (error instanceof MongoServerError && error.code === 20) {
          transactionSupport = false;
        }

        throw transactionsUnavailable();
      }

      throw error;
    }

    return result as T;
  } finally {
    await session.endSession();
  }
}
