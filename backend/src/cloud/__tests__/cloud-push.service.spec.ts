import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CloudPushService } from '../cloud-push.service';

/**
 * Guards only — the copy itself writes to a second database and is verified by
 * running it. What is worth locking down here is that it stays off unless a
 * target is configured, and that it can only ever move the caller's own idea.
 */
const OLD_URL = process.env.CLOUD_DATABASE_URL;
afterAll(() => {
  if (OLD_URL === undefined) delete process.env.CLOUD_DATABASE_URL;
  else process.env.CLOUD_DATABASE_URL = OLD_URL;
});

function setup(idea: any = { id: 'idea1', founderId: 'founder1', title: 'T', validations: [], aiValidationRuns: [], surveys: [] }) {
  const prisma: any = {
    idea: { findUnique: jest.fn().mockResolvedValue(idea) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new CloudPushService(prisma), prisma };
}

describe('configuration gate', () => {
  it('is disabled when no cloud target is set', () => {
    delete process.env.CLOUD_DATABASE_URL;
    expect(CloudPushService.isConfigured()).toBe(false);
    expect(CloudPushService.targetLabel()).toBe('');
  });

  it('refuses to push when no cloud target is set', async () => {
    delete process.env.CLOUD_DATABASE_URL;
    const { service, prisma } = setup();

    await expect(service.pushIdea('idea1', 'founder1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    // It must not even read the idea before deciding it cannot push.
    expect(prisma.idea.findUnique).not.toHaveBeenCalled();
  });

  it('reports only the host, never the credentials', () => {
    process.env.CLOUD_DATABASE_URL = 'postgresql://user:sup3rsecret@db.example.com:5432/live';
    expect(CloudPushService.targetLabel()).toBe('db.example.com:5432');
    expect(CloudPushService.targetLabel()).not.toContain('sup3rsecret');
  });

  it('degrades to a neutral label rather than leaking a malformed URL', () => {
    process.env.CLOUD_DATABASE_URL = 'not a url';
    expect(CloudPushService.targetLabel()).toBe('the configured database');
  });
});

describe('ownership', () => {
  beforeEach(() => { process.env.CLOUD_DATABASE_URL = 'postgresql://u:p@db.example.com:5432/live'; });

  it('refuses an idea belonging to someone else', async () => {
    const { service } = setup();
    await expect(service.pushIdea('idea1', 'intruder')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reports a missing idea rather than pushing nothing', async () => {
    const { service } = setup(null);
    await expect(service.pushIdea('ghost', 'founder1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('error messages', () => {
  const describe_ = (err: any) => (new CloudPushService({} as any) as any).describe(err);

  it('points at the connection string when the database is unreachable', () => {
    expect(describe_(new Error("Can't reach database server at db.example.com"))).toContain('CLOUD_DATABASE_URL');
  });

  it('calls out rejected credentials', () => {
    expect(describe_(new Error('authentication failed for user'))).toContain('rejected the credentials');
  });

  it('suggests deploying first when the live schema is behind', () => {
    expect(describe_(new Error('relation "AiValidationRun" does not exist'))).toContain('deploy the current code');
  });
});
