import { RequirementStatus, StageStatus } from '@prisma/client';
import { calculateProgress, type ProgressStageInput } from './case-progress';

const stage = (
  status: StageStatus,
  requirements: Array<[RequirementStatus, boolean?]> = [],
): ProgressStageInput => ({
  status,
  requirements: requirements.map(([requirementStatus, required = true]) => ({
    status: requirementStatus,
    required,
  })),
});

describe('calculateProgress', () => {
  it('is 0 for a case that has not started', () => {
    expect(
      calculateProgress([
        stage(StageStatus.PENDING, [[RequirementStatus.PENDING]]),
        stage(StageStatus.PENDING),
      ]),
    ).toBe(0);
  });

  it('is 100 when every stage and every required document is done', () => {
    expect(
      calculateProgress([
        stage(StageStatus.COMPLETED, [[RequirementStatus.APPROVED]]),
        stage(StageStatus.COMPLETED, [[RequirementStatus.WAIVED]]),
      ]),
    ).toBe(100);
  });

  it('counts a stage in progress by its own document fulfilment', () => {
    // stages (1 + 0.5)/2 = 0.75 ; documents (1 + 0.5)/2 = 0.75
    expect(
      calculateProgress([
        stage(StageStatus.COMPLETED, [[RequirementStatus.APPROVED]]),
        stage(StageStatus.ACTIVE, [[RequirementStatus.UNDER_REVIEW]]),
      ]),
    ).toBe(75);
  });

  it('counts an active stage with no documents as half a stage', () => {
    expect(calculateProgress([stage(StageStatus.COMPLETED), stage(StageStatus.ACTIVE)])).toBe(75);
  });

  it('gives a rejected document no credit', () => {
    const withRejection = calculateProgress([
      stage(StageStatus.ACTIVE, [[RequirementStatus.REJECTED], [RequirementStatus.APPROVED]]),
    ]);
    const withPending = calculateProgress([
      stage(StageStatus.ACTIVE, [[RequirementStatus.PENDING], [RequirementStatus.APPROVED]]),
    ]);
    expect(withRejection).toBe(withPending);
  });

  it('ignores optional documents', () => {
    expect(
      calculateProgress([stage(StageStatus.COMPLETED, [[RequirementStatus.APPROVED], [RequirementStatus.PENDING, false]])]),
    ).toBe(100);
  });

  it('falls back to stage progress when a case has no required documents', () => {
    expect(calculateProgress([stage(StageStatus.COMPLETED), stage(StageStatus.PENDING)])).toBe(50);
  });

  it('counts loose requirements towards the document score only', () => {
    const stages = [stage(StageStatus.COMPLETED), stage(StageStatus.PENDING)];
    expect(calculateProgress(stages, [{ status: RequirementStatus.PENDING, required: true }])).toBe(20);
  });

  it('blocked stages score zero', () => {
    expect(calculateProgress([stage(StageStatus.COMPLETED), stage(StageStatus.BLOCKED)])).toBe(50);
  });
});
