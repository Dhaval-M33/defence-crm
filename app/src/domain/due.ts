import type { RequirementStatus } from "./coverage";
import { isDueOnOrBefore } from "./dates";

/** A requirement still awaiting its submission, so its deadline still matters. */
export const OPEN_FOR_SUBMISSION_STATUSES: readonly RequirementStatus[] = [
  "received",
  "qualifying",
  "quoted",
  "submitted",
];

export interface DueCandidate {
  readonly id: string;
  readonly status: RequirementStatus;
  readonly submissionDeadline: string;
}

/**
 * Requirements due today or earlier. Closed requirements (won, lost, cancelled)
 * are excluded, because a bid already decided does not need following up.
 */
export function dueOnOrBefore<T extends DueCandidate>(
  requirements: readonly T[],
  todayIso: string,
): T[] {
  return requirements.filter(
    (requirement) =>
      OPEN_FOR_SUBMISSION_STATUSES.indexOf(requirement.status) !== -1 &&
      isDueOnOrBefore(requirement.submissionDeadline, todayIso),
  );
}

export function isOverdue(requirement: DueCandidate, todayIso: string): boolean {
  return (
    OPEN_FOR_SUBMISSION_STATUSES.indexOf(requirement.status) !== -1 &&
    requirement.submissionDeadline !== "" &&
    requirement.submissionDeadline < todayIso
  );
}
