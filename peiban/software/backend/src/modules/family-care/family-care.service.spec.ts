jest.mock('../../entities/family-task.entity', () => ({
  FamilyTask: class FamilyTask {},
  FamilyTaskStatus: {
    PENDING: 'pending',
    BROADCASTED: 'broadcasted',
  },
}));

jest.mock('../../entities/family-message.entity', () => ({
  FamilyMessage: class FamilyMessage {},
}));

jest.mock('../../entities/voiceprint-profile.entity', () => ({
  VoiceprintProfile: class VoiceprintProfile {},
  VoiceprintStatus: {
    ACTIVE: 'active',
  },
}));

const { FamilyCareService } = require('./family-care.service') as typeof import('./family-care.service');
const { FamilyTaskStatus } = require('../../entities/family-task.entity') as typeof import('../../entities/family-task.entity');
const { VoiceprintStatus } = require('../../entities/voiceprint-profile.entity') as typeof import('../../entities/voiceprint-profile.entity');

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: payload.id ?? 1, ...payload })),
  };
}

describe('FamilyCareService', () => {
  it('creates a family task and marks it broadcasted by mock receipt', async () => {
    const taskRepo = createRepoMock();
    const messageRepo = createRepoMock();
    const voiceprintRepo = createRepoMock();
    taskRepo.findOne.mockResolvedValue({ id: 1, status: 'pending' });

    const service = new FamilyCareService(taskRepo as any, messageRepo as any, voiceprintRepo as any);
    await service.createTask(9, { familyId: 2, elderId: 3, title: '提醒喝水', type: 'drink_water' });
    await service.mockTaskReceipt(1, { status: FamilyTaskStatus.BROADCASTED, elderResponse: '已喝水' });

    expect(taskRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 2, elderId: 3, createdBy: 9 }),
    );
    expect(taskRepo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 1,
        status: FamilyTaskStatus.BROADCASTED,
        elderResponse: '已喝水',
      }),
    );
  });

  it('updates a voiceprint profile status', async () => {
    const taskRepo = createRepoMock();
    const messageRepo = createRepoMock();
    const voiceprintRepo = createRepoMock();
    voiceprintRepo.findOne.mockResolvedValue({ id: 5, status: 'enrolling' });

    const service = new FamilyCareService(taskRepo as any, messageRepo as any, voiceprintRepo as any);
    await service.updateVoiceprintStatus(5, { status: VoiceprintStatus.ACTIVE, confidence: 0.92 });

    expect(voiceprintRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        status: VoiceprintStatus.ACTIVE,
        confidence: 0.92,
      }),
    );
  });
});
