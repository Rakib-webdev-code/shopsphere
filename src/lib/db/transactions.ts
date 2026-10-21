import { db, mongoClient } from "@/lib/mongodb";

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

export async function supportsTransactions(): Promise<boolean> {
  if (transactionSupport !== null) {
    return transactionSupport;
  }

  const forced = forcedTransactionSupport();

  if (forced !== null) {
    transactionSupport = forced;
    return forced;
  }

  try {
    const hello = (await db.admin().command({ hello: 1 })) as {
      setName?: string;
      msg?: string;
    };

    transactionSupport = Boolean(hello.setName || hello.msg === "isdbgrid");
  } catch {
    transactionSupport = false;
  }

  return transactionSupport;
}

export async function runOptionalTransaction<T>(
  work: (session?: import("mongodb").ClientSession) => Promise<T>,
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
