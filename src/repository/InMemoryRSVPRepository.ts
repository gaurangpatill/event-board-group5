import { randomUUID } from "node:crypto";
import { Err, Ok } from "../lib/result";
import type { Result } from "../lib/result";
import type { IRSVPRecord, RSVPStatus } from "../lib/rsvp";
import type { RSVPError } from "../lib/rsvpErrors";
import { UnexpectedDependencyError } from "../lib/rsvpErrors";
import type { CreateRSVPInput, IRSVPRepository } from "./IRSVPRepository";

class InMemoryRSVPRepository implements IRSVPRepository {
  private readonly store = new Map<string, IRSVPRecord>();

  private clone(record: IRSVPRecord): IRSVPRecord {
    return { ...record };
  }

  async findRSVP(
    eventId: string,
    userId: string,
  ): Promise<Result<IRSVPRecord | null, RSVPError>> {
    try {
      const found =
        Array.from(this.store.values()).find(
          (rsvp) => rsvp.eventId === eventId && rsvp.userId === userId,
        ) ?? null;
      return Ok(found ? this.clone(found) : null);
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `findRSVP failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async createRSVP(
    rsvp: CreateRSVPInput,
  ): Promise<Result<IRSVPRecord, RSVPError>> {
    try {
      const now = new Date();
      const record: IRSVPRecord = {
        ...rsvp,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      this.store.set(record.id, record);
      return Ok(this.clone(record));
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `createRSVP failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async updateRSVP(
    id: string,
    status: RSVPStatus,
  ): Promise<Result<IRSVPRecord, RSVPError>> {
    try {
      const existing = this.store.get(id);
      if (!existing) {
        return Err(
          UnexpectedDependencyError(`updateRSVP: record ${id} not found`),
        );
      }

      const updated: IRSVPRecord = {
        ...existing,
        status,
        updatedAt: new Date(),
      };
      this.store.set(id, updated);
      return Ok(this.clone(updated));
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `updateRSVP failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async listRSVPByUser(
    userId: string,
  ): Promise<Result<IRSVPRecord[], RSVPError>> {
    try {
      const results = Array.from(this.store.values())
        .filter((rsvp) => rsvp.userId === userId)
        .map((rsvp) => this.clone(rsvp));
      return Ok(results);
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `listRSVPByUser failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async listRSVPByEvent(
    eventId: string,
  ): Promise<Result<IRSVPRecord[], RSVPError>> {
    try {
      const results = Array.from(this.store.values())
        .filter((rsvp) => rsvp.eventId === eventId)
        .map((rsvp) => this.clone(rsvp));
      return Ok(results);
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `listRSVPByEvent failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async findNextWaitlisted(
    eventId: string,
  ): Promise<Result<IRSVPRecord | null, RSVPError>> {
    try {
      const waitlisted = Array.from(this.store.values())
        .filter((rsvp) => rsvp.eventId === eventId && rsvp.status === "waitlisted")
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
      return Ok(waitlisted[0] ? this.clone(waitlisted[0]) : null);
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `findNextWaitlisted failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async cancelAndPromoteWaitlist(
    cancelId: string,
    promoteId: string,
  ): Promise<Result<void, RSVPError>> {
    try {
      const toCancel = this.store.get(cancelId);
      const toPromote = this.store.get(promoteId);

      if (!toCancel || !toPromote) {
        return Err(
          UnexpectedDependencyError(
            "cancelAndPromoteWaitlist: one or both records not found",
          ),
        );
      }

      const now = new Date();
      this.store.set(cancelId, {
        ...toCancel,
        status: "cancelled",
        updatedAt: now,
      });
      this.store.set(promoteId, {
        ...toPromote,
        status: "going",
        updatedAt: now,
      });

      return Ok(undefined);
    } catch (error) {
      return Err(
        UnexpectedDependencyError(
          `cancelAndPromoteWaitlist failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}

export function CreateInMemoryRSVPRepository(): IRSVPRepository {
  return new InMemoryRSVPRepository();
}
