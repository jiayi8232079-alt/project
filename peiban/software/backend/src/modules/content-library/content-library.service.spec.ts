import { NotFoundException } from '@nestjs/common';

jest.mock('../../entities/content-item.entity', () => ({
  ContentItem: class ContentItem {},
}));

const { ContentLibraryService } =
  require('./content-library.service') as typeof import('./content-library.service');

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(async () => []),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: payload.id ?? 1, ...payload })),
  };
}

describe('ContentLibraryService', () => {
  it('lists only active items, filtered by category', async () => {
    const repo = createRepoMock();
    const service = new ContentLibraryService(repo as any);
    await service.list({ category: 'xiqu' });

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true, category: 'xiqu' }),
      }),
    );
  });

  it('creates an active content item', async () => {
    const repo = createRepoMock();
    const service = new ContentLibraryService(repo as any);
    await service.create({ category: 'song', title: '甜蜜蜜' });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'song', title: '甜蜜蜜', active: true }),
    );
  });

  it('dispatches a play request for an existing item', async () => {
    const repo = createRepoMock();
    repo.findOne.mockResolvedValue({ id: 5, title: '白眉大侠' });
    const service = new ContentLibraryService(repo as any);

    const result = await service.play(5, { deviceId: 3 });
    expect(result).toEqual(
      expect.objectContaining({ dispatched: true, contentId: 5, deviceId: 3 }),
    );
  });

  it('throws when playing a missing item', async () => {
    const repo = createRepoMock();
    repo.findOne.mockResolvedValue(null);
    const service = new ContentLibraryService(repo as any);

    await expect(service.play(404, {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
