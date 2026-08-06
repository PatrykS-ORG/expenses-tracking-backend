import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import axios from 'axios';

jest.mock('axios');

describe('UserProfileService', () => {
  let service: UserProfileService;

  const prismaMock = {
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://project.supabase.co';
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
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
        ai_credit_limit: 50,
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
        ai_credit_limit: 50,
      },
      update: { email: 'user@example.com' },
    });
  });

  it('treats concurrent first-login email conflicts as success when profile exists', async () => {
    prismaMock.user.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '7.8.0' },
      ),
    );
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'oauth-user-1',
      email: 'user@example.com',
    });

    await expect(
      service.ensureUserProfile('oauth-user-1', 'user@example.com'),
    ).resolves.toBeUndefined();

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'oauth-user-1' },
      select: { id: true, email: true },
    });
  });

  it('rejects email conflicts that belong to another auth user', async () => {
    prismaMock.user.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '7.8.0' },
      ),
    );
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.ensureUserProfile('oauth-user-1', 'user@example.com'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes the auth user and local profile', async () => {
    const axiosMock = jest.mocked(axios);
    prismaMock.user.findUnique.mockResolvedValue(null);
    axiosMock.delete.mockResolvedValue({ status: 200 });

    await expect(service.deleteAccount('user-1')).resolves.toBe(true);

    const [url, config] = axiosMock.delete.mock.calls[0];
    expect(url).toBe('https://project.supabase.co/auth/v1/admin/users/user-1');
    expect(config?.headers).toMatchObject({
      Authorization: 'Bearer service-role-key',
    });
    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('treats a missing auth identity as an idempotent success', async () => {
    const axiosMock = jest.mocked(axios);
    prismaMock.user.findUnique.mockResolvedValue(null);
    axiosMock.delete.mockRejectedValue({ response: { status: 404 } });

    await expect(service.deleteAccount('user-1')).resolves.toBe(true);

    expect(prismaMock.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('does not delete the local profile when auth deletion fails', async () => {
    const axiosMock = jest.mocked(axios);
    prismaMock.user.findUnique.mockResolvedValue(null);
    axiosMock.delete.mockRejectedValue({ response: { status: 500 } });

    await expect(service.deleteAccount('user-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(prismaMock.user.deleteMany).not.toHaveBeenCalled();
  });
});
