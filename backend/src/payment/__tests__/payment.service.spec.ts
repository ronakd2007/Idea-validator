import { PaymentService } from '../payment.service';

/**
 * The AI Deep Dive auto-start hangs off payment completion — the moment an idea
 * actually goes live. These lock the two properties that matter: research
 * starts for every paid idea (revisions included), and research failing can
 * never fail the payment that triggered it.
 */
function setup(agentOverrides: Partial<{ startRun: jest.Mock }> = {}) {
  const prisma: any = {
    idea: {
      findUnique: jest.fn().mockResolvedValue({ id: 'idea1', founderId: 'founder1', isRevision: false, title: 'T', version: 1, founder: { name: 'F', role: 'FOUNDER' } }),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: { create: jest.fn().mockResolvedValue({}) },
  };
  const config: any = { get: (_k: string, d: any) => d };
  const activity: any = { log: jest.fn().mockResolvedValue(undefined) };
  const agent: any = { startRun: agentOverrides.startRun ?? jest.fn().mockResolvedValue({ runId: 'run1', alreadyRunning: false }) };

  return { service: new PaymentService(config, prisma, activity, agent), prisma, agent };
}

describe('mockPayment', () => {
  it('starts an AI Deep Dive once the idea is paid for', async () => {
    const { service, prisma, agent } = setup();

    await service.mockPayment('idea1', 'founder1');

    expect(prisma.idea.update).toHaveBeenCalledWith({ where: { id: 'idea1' }, data: { paymentStatus: 'COMPLETED' } });
    expect(agent.startRun).toHaveBeenCalledWith('idea1', 'founder1', 'auto');
  });

  it('starts one for a revision too — revisions complete through this same path', async () => {
    const { service, prisma, agent } = setup();
    prisma.idea.findUnique.mockResolvedValue({ id: 'rev1', founderId: 'founder1', isRevision: true, title: 'T v2', version: 2, founder: { name: 'F', role: 'FOUNDER' } });

    await service.mockPayment('rev1', 'founder1');

    expect(agent.startRun).toHaveBeenCalledWith('rev1', 'founder1', 'auto');
  });

  it('still completes the payment when research cannot be started', async () => {
    const startRun = jest.fn().mockRejectedValue(new Error('Groq unavailable'));
    const { service, prisma } = setup({ startRun });

    await expect(service.mockPayment('idea1', 'founder1')).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
    expect(prisma.payment.create).toHaveBeenCalled();

    // The rejection is swallowed asynchronously; let it settle so it cannot
    // surface as an unhandled rejection.
    await new Promise(resolve => setImmediate(resolve));
  });

  it('does not start research when the payment never happens', async () => {
    const { service, agent, prisma } = setup();
    prisma.idea.findUnique.mockResolvedValue(null);

    await expect(service.mockPayment('ghost', 'founder1')).rejects.toThrow();
    expect(agent.startRun).not.toHaveBeenCalled();
  });

  it('does not start research for someone else’s idea', async () => {
    const { service, agent } = setup();

    await expect(service.mockPayment('idea1', 'intruder')).rejects.toThrow();
    expect(agent.startRun).not.toHaveBeenCalled();
  });
});
