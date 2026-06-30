import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileService } from './user-profile.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  const prismaMock = {
    user: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
  });

  it('uses fallback email when token does not include one', async () => {
    await service.ensureUserProfile('oauth-user-1');

    expect(prismaMock.user.upsert).toHaveBeenCalledWith({
      where: { id: 'oauth-user-1' },
      create: {
        id: 'oauth-user-1',
        email: 'oauth-user-1@users.expenseai.local',
      },
      update: {},
    });
  });

  it('updates profile email when token provides it', async () => {
    await service.ensureUserProfile('oauth-user-1', '  user@example.com  ');

    expect(prismaMock.user.upsert).toHaveBeenCalledWith({
      where: { id: 'oauth-user-1' },
      create: {
        id: 'oauth-user-1',
        email: 'user@example.com',
      },
      update: { email: 'user@example.com' },
    });
  });
});
