// src/repository/InMemoryRSVPRepository.ts
// In-memory implementation of IRSVPRepository.
// Branch: task/rsvp-dashboard-repo

import { randomUUID } from "node:crypto";
import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import type { RSVPError } from "../lib/rsvpErrors";
import { UnexpectedDependencyError } from "../lib/rsvpErrors";
import type { IRSVPRecord, RSVPStatus } from "../lib/rsvp";
import type { IRSVPRepository, CreateRSVPInput } from "./IRSVPrepo";

class InMemoryRSVPRepository implements IRSVPRepository {
  // Maps RSVP id → record.
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
          (r) => r.eventId === eventId && r.userId === userId,
        ) ?? null;
      return Ok(found ? this.clone(found) : null);
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `findRSVP failed: ${e instanceof Error ? e.message : String(e)}`,
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
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `createRSVP failed: ${e instanceof Error ? e.message : String(e)}`,
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
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `updateRSVP failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  async listRSVPByUser(
    userId: string,
  ): Promise<Result<IRSVPRecord[], RSVPError>> {
    try {
      const results = Array.from(this.store.values())
        .filter((r) => r.userId === userId)
        .map(this.clone);
      return Ok(results);
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `listRSVPByUser failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  async listRSVPByEvent(
    eventId: string,
  ): Promise<Result<IRSVPRecord[], RSVPError>> {
    try {
      const results = Array.from(this.store.values())
        .filter((r) => r.eventId === eventId)
        .map(this.clone);
      return Ok(results);
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `listRSVPByEvent failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  /**
   * Find the earliest waitlisted RSVP for an event.
   * "Earliest" = lowest createdAt timestamp.
   */
  async findNextWaitlisted(
    eventId: string,
  ): Promise<Result<IRSVPRecord | null, RSVPError>> {
    try {
      const waitlisted = Array.from(this.store.values())
        .filter((r) => r.eventId === eventId && r.status === "waitlisted")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return Ok(waitlisted[0] ? this.clone(waitlisted[0]) : null);
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `findNextWaitlisted failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }

  /**
   * Atomically cancel one RSVP and promote the waitlisted one to "going".
   * In-memory: both writes happen synchronously in the same JS microtask,
   * so there is no race condition here.
   * In a Prisma implementation, wrap both in a transaction.
   */
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
            `cancelAndPromoteWaitlist: one or both records not found`,
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
    } catch (e) {
      return Err(
        UnexpectedDependencyError(
          `cancelAndPromoteWaitlist failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
  }
}

export function CreateInMemoryRSVPRepository(): IRSVPRepository {
  return new InMemoryRSVPRepository();
}