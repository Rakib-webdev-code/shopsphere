import { db, mongoClient } from "@/lib/mongodb";

let transactionSupport: boolean | null = null;

export async function supportsTransactions(): Promise<boolean> {
  if (transactionSupport !== null) {
    return transactionSupport;
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
