jest.mock('../../entities/service-provider.entity', () => ({
  ServiceProvider: class ServiceProvider {},
  ServiceProviderStatus: { ACTIVE: 'active' },
}));

jest.mock('../../entities/hospital-partnership.entity', () => ({
  HospitalPartnership: class HospitalPartnership {},
  HospitalPartnershipStatus: { ACTIVE: 'active' },
}));

const { ServiceCollaborationService } = require('./service-collaboration.service') as typeof import('./service-collaboration.service');
const { ServiceProviderStatus } = require('../../entities/service-provider.entity') as typeof import('../../entities/service-provider.entity');
const { HospitalPartnershipStatus } = require('../../entities/hospital-partnership.entity') as typeof import('../../entities/hospital-partnership.entity');

function createRepoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: payload.id ?? 1, ...payload })),
  };
}

describe('ServiceCollaborationService', () => {
  it('creates a service provider with active catalog metadata', async () => {
    const providerRepo = createRepoMock();
    const partnershipRepo = createRepoMock();
    const service = new ServiceCollaborationService(providerRepo as any, partnershipRepo as any);

    await service.createProvider({
      name: '安心家政',
      type: 'housekeeping',
      serviceArea: ['杭州'],
      catalog: [{ code: 'cleaning', name: '保洁', price: 199 }],
    });

    expect(providerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '安心家政',
        status: ServiceProviderStatus.ACTIVE,
      }),
    );
  });

  it('creates an active hospital partnership', async () => {
    const providerRepo = createRepoMock();
    const partnershipRepo = createRepoMock();
    const service = new ServiceCollaborationService(providerRepo as any, partnershipRepo as any);

    await service.createHospitalPartnership({
      hospitalId: 3,
      hospitalName: '杭州市第一人民医院',
      partnershipType: 'follow_up',
      resources: [{ department: '老年医学科' }],
    });

    expect(partnershipRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        hospitalId: 3,
        status: HospitalPartnershipStatus.ACTIVE,
      }),
    );
  });
});
