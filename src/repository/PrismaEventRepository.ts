import { PrismaClient } from "@prisma/client";
import { Err, Ok, Result } from "../lib/result.js";
import {
  EventNotFound, UnexpectedDependencyError, EventError
} from "../lib/errors.js";
import type { IEventRecord } from "../lib/event";
import type { IEventRepository, EventFilterOptions } from "./EventRepository";
import { randomUUID } from "crypto";

function clone(record: IEventRecord): IEventRecord {
  return { ...record };
}

class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findEventById(id: string): Promise<Result<IEventRecord | null, EventError>> {
    try {
      const record = await this.prisma.event.findUnique({ where: { id } });
      return Ok(record ? clone(record));
    } catch (e){
      return Err(UnexpectedDependencyError(`findEventById failed: ${e instanceof Error ? e.message : String(e)}`));
    }
  }


}

