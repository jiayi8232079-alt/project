jest.mock('../../entities/community-content.entity', () => ({
  CommunityContent: class CommunityContent {},
  CommunityContentStatus: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    REVOKED: 'revoked',
  },
}));

jest.mock('../../entities/content-delivery.entity', () => ({
  ContentDelivery: class ContentDelivery {},
  ContentDeliveryStatus: {
    QUEUED: 'queued',
    PLAYED: 'played',
    APP_VIEWED: 'app_viewed',
  },
}));

const { CommunityContentService } = require('./community-content.service') as typeof import('./community-content.service');
const { ContentDeliveryStatus } = require('../../entities/content-delivery.entity') as typeof import('../../entities/content-delivery.entity');

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: payload.id ?? 1, ...payload })),
  };
}

describe('CommunityContentService', () => {
  it('publishes content and creates one delivery per target device', async () => {
    const contentRepo = createRepoMock();
    const deliveryRepo = createRepoMock();
    contentRepo.findOne.mockResolvedValue({
      id: 1,
      status: 'draft',
      target: { deviceIds: [10, 11] },
    });

    const service = new CommunityContentService(contentRepo as any, deliveryRepo as any);
    await service.publish(1);

    expect(contentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, status: 'published' }),
    );
    expect(deliveryRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ contentId: 1, deviceId: 10, status: 'queued' }),
        expect.objectContaining({ contentId: 1, deviceId: 11, status: 'queued' }),
      ]),
    );
  });

  it('updates delivery status with mock ack', async () => {
    const contentRepo = createRepoMock();
    const deliveryRepo = createRepoMock();
    deliveryRepo.findOne.mockResolvedValue({ id: 8, status: 'queued' });

    const service = new CommunityContentService(contentRepo as any, deliveryRepo as any);
    await service.mockAck(8, { status: ContentDeliveryStatus.PLAYED });

    expect(deliveryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 8,
        status: ContentDeliveryStatus.PLAYED,
      }),
    );
  });
});
