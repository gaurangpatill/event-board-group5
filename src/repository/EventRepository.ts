import type { Result } from "../lib/result";
import type { EventError } from "../lib/errors";
import type { IEventRecord } from "../lib/event";
import {Ok, Err} from "../lib/result";
import {
  EventNotFound,
  UnexpectedDependencyError,
} from "../lib/errors";
 
 
export interface IEventRepository {
  findEventById(id: string): Promise<Result<IEventRecord | null, EventError>>;
  updateEvent(
  id: string,
  changes: Partial<Omit<IEventRecord, "id" | "organizerId" | "createdAt">>
): Promise<Result<IEventRecord, EventError>>;
}

export const eventStorage: IEventRecord[] = [];

class InMemoryEventRepository implements IEventRepository {

  async findEventById(
    id: string,
  ): ReturnType<IEventRepository["findEventById"]> {
    try {
      const match = eventStorage.find((e) => e.id === id) ?? null;
      return Ok(match);
    } catch {
      return Err(UnexpectedDependencyError("Failed to read events."));
    }
  }


  
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}