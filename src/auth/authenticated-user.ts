import { UnauthorizedException } from '@nestjs/common';

export interface AuthenticatedUser {
  sub?: string;
  id?: string;
  email?: string;
}

export function extractUserId(user: AuthenticatedUser): string {
  const userId = user?.sub ?? user?.id;
  if (!userId) {
    throw new UnauthorizedException('Missing authenticated user identifier');
  }
  return userId;
}
