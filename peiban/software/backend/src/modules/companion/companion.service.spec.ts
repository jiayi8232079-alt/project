jest.mock('../../entities/companion-memory.entity', () => ({
  CompanionMemory: class CompanionMemory {},
  CompanionMemoryScope: {
    MEMBER_IDENTITY: 'member_identity',
    MEMBER_PRIVATE: 'member_private',
    FAMILY_SHARED: 'family_shared',
    HEALTH_FACT: 'health_fact',
    ROBOT_RELATION: 'robot_relation',
  },
  CompanionMemoryStatus: {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    DELETED: 'deleted',
  },
}));

jest.mock('../../entities/companion-persona.entity', () => ({
  CompanionPersona: class CompanionPersona {},
}));

const { CompanionService } = require('./companion.service') as typeof import('./companion.service');
const { CompanionMemoryScope, CompanionMemoryStatus } =
  require('../../entities/companion-memory.entity') as typeof import('../../entities/companion-memory.entity');

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: payload.id ?? 1, ...payload })),
    createQueryBuilder: jest.fn(),
  };
}

describe('CompanionService', () => {
  it('saves a new memory when no matching memoryKey exists', async () => {
    const memoryRepo = createRepoMock();
    const personaRepo = createRepoMock();
    memoryRepo.findOne.mockResolvedValue(null);

    const service = new CompanionService(memoryRepo as any, personaRepo as any);
    await service.saveMemory({
      familyId: 2,
      memberId: 3,
      scope: CompanionMemoryScope.MEMBER_PRIVATE,
      memoryKey: 'favorite_food',
      content: '喜欢红烧肉',
    });

    expect(memoryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 2,
        memberId: 3,
        scope: CompanionMemoryScope.MEMBER_PRIVATE,
        memoryKey: 'favorite_food',
        status: CompanionMemoryStatus.ACTIVE,
      }),
    );
  });

  it('soft-deletes a memory on forget', async () => {
    const memoryRepo = createRepoMock();
    const personaRepo = createRepoMock();
    memoryRepo.findOne.mockResolvedValue({ id: 7, status: CompanionMemoryStatus.ACTIVE });

    const service = new CompanionService(memoryRepo as any, personaRepo as any);
    await service.forgetMemory(7);

    expect(memoryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, status: CompanionMemoryStatus.DELETED }),
    );
  });

  it('returns a default persona when none is stored', async () => {
    const memoryRepo = createRepoMock();
    const personaRepo = createRepoMock();
    personaRepo.findOne.mockResolvedValue(null);

    const service = new CompanionService(memoryRepo as any, personaRepo as any);
    await service.getPersona(2);

    expect(personaRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 2, nickname: '小伴', personality: 'warm' }),
    );
  });
});
