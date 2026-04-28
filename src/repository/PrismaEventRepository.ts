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

  async updateEvent(id: string, changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>): Promise<Result<IEventRecord, EventError>> {
    try{
        const existing = await this.prisma.event.findUnique({where : {id}})
        if (!existing){
            return Err(EventNotFound(`updateEvent: record ${id} not found`))
        }
        const updated: IEventRecord = {...existing, ...changes, updatedAt: new Date(),}
        await this.prisma.event.update({where: {id}, data: {...changes}})
        return Ok(clone(updated))
    } catch (e){
        return Err(UnexpectedDependencyError(`updateEvent failed: ${e instanceof Error ? e.message : String(e)}`))
    }
  }

}

