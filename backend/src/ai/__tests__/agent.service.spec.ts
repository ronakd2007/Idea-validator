import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgentService } from '../agent.service';

/**
 * Lifecycle guards only — the pipeline itself is stubbed out. What matters here
 * is that a run is never started twice, never billed for an unpaid idea, and
 * that an interrupted run heals instead of blocking every future one.
 */
function setup(overrides: { idea?: any; activeRun?: any } = {}) {
  const idea = overrides.idea === undefined
    ? { id: 'idea1', founderId: 'founder1', paymentStatus: 'COMPLETED' }
    : overrides.idea;

  const prisma: any = {
    idea: { findUnique: jest.fn().mockResolvedValue(idea) },
    aiValidationRun: {
      findFirst: jest.fn().mockResolvedValue(overrides.activeRun ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'run1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    survey: { findFirst: jest.fn().mockResolvedValue(null) },
    validationResponse: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const service = new AgentService(prisma, {} as any);
  // The pipeline is exercised by its own units; here it must simply not run.
  (service as any).runPipeline = jest.fn().mockResolvedValue(undefined);
  return { service, prisma };
}

const OLD_ENV = process.env.ANTHROPIC_API_KEY;
beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; });
afterAll(() => { process.env.ANTHROPIC_API_KEY = OLD_ENV; });

describe('startRun', () => {
  it('starts a run for a paid idea', async () => {
    const { service, prisma } = setup();

    const res = await service.startRun('idea1', 'founder1', 'manual');

    expect(res).toEqual({ runId: 'run1', alreadyRunning: false });
    expect(prisma.aiValidationRun.create).toHaveBeenCalled();
    // All six steps are seeded up front so the UI can draw the whole stepper.
    const seeded = JSON.parse(prisma.aiValidationRun.create.mock.calls[0][0].data.steps);
    expect(seeded).toHaveLength(6);
    expect(seeded.every((s: any) => s.status === 'PENDING')).toBe(true);
  });

  it('refuses a manual run before the idea is submitted', async () => {
    const { service, prisma } = setup({ idea: { id: 'idea1', founderId: 'founder1', paymentStatus: 'PENDING' } });

    await expect(service.startRun('idea1', 'founder1', 'manual')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiValidationRun.create).not.toHaveBeenCalled();
  });

  it('rejects a manual run by someone else', async () => {
    const { service } = setup();
    await expect(service.startRun('idea1', 'intruder', 'manual')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws for a missing idea on the manual path', async () => {
    const { service } = setup({ idea: null });
    await expect(service.startRun('ghost', 'founder1', 'manual')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stays silent on the automatic path when the idea is gone', async () => {
    const { service, prisma } = setup({ idea: null });

    // A payment must never fail because research could not start.
    await expect(service.startRun('ghost', 'founder1', 'auto')).resolves.toEqual({ runId: null, alreadyRunning: false });
    expect(prisma.aiValidationRun.create).not.toHaveBeenCalled();
  });

  it('skips silently on the automatic path when the AI key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { service, prisma } = setup();

    await expect(service.startRun('idea1', 'founder1', 'auto')).resolves.toEqual({ runId: null, alreadyRunning: false });
    expect(prisma.aiValidationRun.create).not.toHaveBeenCalled();
  });

  it('does not start a second run while one is genuinely in progress', async () => {
    const { service, prisma } = setup({ activeRun: { id: 'running1', updatedAt: new Date() } });

    const res = await service.startRun('idea1', 'founder1', 'manual');

    expect(res).toEqual({ runId: 'running1', alreadyRunning: true });
    expect(prisma.aiValidationRun.create).not.toHaveBeenCalled();
  });

  it('marks an abandoned run failed and starts a fresh one', async () => {
    const stale = new Date(Date.now() - 10 * 60_000);
    const { service, prisma } = setup({ activeRun: { id: 'zombie', updatedAt: stale } });

    const res = await service.startRun('idea1', 'founder1', 'manual');

    expect(prisma.aiValidationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'zombie' },
        data: expect.objectContaining({ status: 'FAILED', error: expect.stringContaining('interrupted') }),
      }),
    );
    expect(res.alreadyRunning).toBe(false);
    expect(prisma.aiValidationRun.create).toHaveBeenCalled();
  });
});

describe('getLatest', () => {
  it('parses the stored run and never trusts corrupt JSON', async () => {
    const { service, prisma } = setup();
    prisma.aiValidationRun.findFirst
      .mockResolvedValueOnce(null) // reconcile: nothing active
      .mockResolvedValueOnce({
        id: 'run1', status: 'COMPLETED', steps: '{{{not json', report: 'also broken',
        error: null, webSearchUsed: true, searchCount: 4,
        startedAt: null, completedAt: null, createdAt: new Date(),
      });

    const res = await service.getLatest('idea1', 'founder1');

    expect(res.run!.steps).toEqual([]);
    expect(res.run!.report).toBeNull();
  });

  it('does not repair an interrupted run while an admin is viewing as the founder', async () => {
    const stale = new Date(Date.now() - 10 * 60_000);
    const { service, prisma } = setup();
    prisma.aiValidationRun.findFirst.mockResolvedValue({
      id: 'zombie', status: 'RUNNING', steps: '[]', report: null, error: null,
      webSearchUsed: false, searchCount: 0, startedAt: stale, completedAt: null,
      createdAt: stale, updatedAt: stale,
    });

    await service.getLatest('idea1', 'founder1', { readOnly: true });

    expect(prisma.aiValidationRun.update).not.toHaveBeenCalled();
  });

  it('refuses to read another founder’s runs', async () => {
    const { service } = setup();
    await expect(service.getLatest('idea1', 'intruder')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('listRuns', () => {
  it('exposes only the verdict from each stored report', async () => {
    const { service, prisma } = setup();
    prisma.aiValidationRun.findMany.mockResolvedValue([
      { id: 'r1', status: 'COMPLETED', createdAt: new Date(), completedAt: new Date(), webSearchUsed: true, report: JSON.stringify({ verdict: 'GO', competitors: { direct: [] } }) },
      { id: 'r2', status: 'FAILED', createdAt: new Date(), completedAt: new Date(), webSearchUsed: false, report: null },
    ]);

    const out = await service.listRuns('idea1', 'founder1');

    expect(out[0]).toEqual(expect.objectContaining({ id: 'r1', verdict: 'GO' }));
    expect(out[0]).not.toHaveProperty('report');
    expect(out[1].verdict).toBeNull();
  });
});
