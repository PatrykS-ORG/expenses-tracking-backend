import { UnauthorizedException } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UsersResolver } from './users.resolver';

describe('UsersResolver', () => {
  const deleteAccountMock = jest.fn();
  const userProfileService = {
    deleteAccount: deleteAccountMock,
  } as unknown as UserProfileService;
  const resolver = new UsersResolver(userProfileService);

  beforeEach(() => jest.clearAllMocks());

  it('deletes the authenticated user account', async () => {
    deleteAccountMock.mockResolvedValueOnce(true);

    await expect(resolver.deleteMyAccount({ sub: 'user-1' })).resolves.toBe(
      true,
    );
    expect(deleteAccountMock).toHaveBeenCalledWith('user-1');
  });

  it('rejects a payload without a user id', () => {
    expect(() => resolver.deleteMyAccount({})).toThrow(UnauthorizedException);
  });
});
