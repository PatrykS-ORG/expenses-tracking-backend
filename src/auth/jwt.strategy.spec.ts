import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => jest.fn()),
}));

function createConfigMock(
  values: Record<string, string>,
): Pick<ConfigService, 'get'> {
  return {
    get: jest.fn((key: string | symbol, defaultValue?: unknown) => {
      return values[String(key)] ?? defaultValue;
    }) as ConfigService['get'],
  };
}

describe('JwtStrategy', () => {
  it('throws when neither SUPABASE_URL nor SUPABASE_JWT_SECRET is configured', () => {
    const configMock = createConfigMock({});

    expect(() => new JwtStrategy(configMock as ConfigService)).toThrow(
      'Configure SUPABASE_URL (asymmetric JWKS) or SUPABASE_JWT_SECRET (legacy HS256)',
    );
  });

  it('maps valid payload into authenticated user shape', () => {
    const configMock = createConfigMock({ SUPABASE_JWT_SECRET: 'test-secret' });
    const strategy = new JwtStrategy(configMock as ConfigService);

    const result = strategy.validate({
      sub: 'user-123',
      email: '  user@example.com  ',
      role: 'authenticated',
    });

    expect(result).toEqual({
      id: 'user-123',
      email: 'user@example.com',
      roles: 'authenticated',
    });
  });

  it('rejects payload without sub claim', () => {
    const configMock = createConfigMock({ SUPABASE_JWT_SECRET: 'test-secret' });
    const strategy = new JwtStrategy(configMock as ConfigService);

    expect(() => strategy.validate({ email: 'user@example.com' })).toThrow(
      UnauthorizedException,
    );
  });
});
