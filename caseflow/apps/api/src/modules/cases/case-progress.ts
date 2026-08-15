import { RequirementStatus, StageStatus } from '@prisma/client';

export interface ProgressRequirementInput {
  status: RequirementStatus;
  required: boolean;
}

export interface ProgressStageInput {
  status: StageStatus;
  requirements: ProgressRequirementInput[];
}

/**
 * Case progress blends the two things a client actually asks about:
 *
 *  - how far the workflow has advanced (stage score, 40%);
 *  - how much of the required paperwork is in (document score, 60%).
 *
 * Paperwork carries the larger weight because the later stages of a typical
 * process are external waiting periods the company does not control, while the
 * document set is what the client can act on today.
 *
 * A completed stage counts fully; the stage in progress counts by how much of
 * its own paperwork is in (half, when it has none). A document under review
 * counts as half a document — the work is done, the review is not.
 */
export const STAGE_WEIGHT = 0.4;
export const DOCUMENT_WEIGHT = 0.6;

const REQUIREMENT_SCORE: Record<RequirementStatus, number> = {
  [RequirementStatus.PENDING]: 0,
  [RequirementStatus.REJECTED]: 0,
  [RequirementStatus.UPLOADED]: 0.5,
  [RequirementStatus.UNDER_REVIEW]: 0.5,
  [RequirementStatus.APPROVED]: 1,
  [RequirementStatus.WAIVED]: 1,
};

function fulfilment(requirements: ProgressRequirementInput[]): number | null {
  const scored = requirements.filter((requirement) => requirement.required);
  if (scored.length === 0) return null;
  return scored.reduce((sum, requirement) => sum + REQUIREMENT_SCORE[requirement.status], 0) / scored.length;
}

function stageScoreOf(stage: ProgressStageInput): number {
  switch (stage.status) {
    case StageStatus.COMPLETED:
      return 1;
    case StageStatus.ACTIVE:
      return fulfilment(stage.requirements) ?? 0.5;
    default:
      return 0;
  }
}

/**
 * @param stages the case's own stages, each with its requirements
 * @param looseRequirements requirements not attached to any stage; they count
 *        towards the document score without adding a stage
 */
export function calculateProgress(
  stages: ProgressStageInput[],
  looseRequirements: ProgressRequirementInput[] = [],
): number {
  if (stages.length === 0) return 0;

  const stageScore = stages.reduce((sum, stage) => sum + stageScoreOf(stage), 0) / stages.length;
  const documentScore = fulfilment([...stages.flatMap((stage) => stage.requirements), ...looseRequirements]);

  const blended =
    documentScore === null ? stageScore : stageScore * STAGE_WEIGHT + documentScore * DOCUMENT_WEIGHT;

  return Math.max(0, Math.min(100, Math.round(blended * 100)));
}
