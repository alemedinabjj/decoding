import { asc } from "drizzle-orm";
import { salesReps } from "../db/schema";
import type { Db } from "./opportunity-repository";

export async function findAllSalesReps(db: Db) {
  return db
    .select({ id: salesReps.id, name: salesReps.name, email: salesReps.email })
    .from(salesReps)
    .orderBy(asc(salesReps.name));
}
