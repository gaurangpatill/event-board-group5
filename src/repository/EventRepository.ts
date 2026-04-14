import type { Result } from "../lib/result";
import type { EventError } from "../lib/errors";
import type { IEventRecord } from "../lib/event";
 
 
export interface IEventRepository {
  findEventById(id: string): Promise<Result<IEventRecord | null, EventError>>;
}