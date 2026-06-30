import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureUserProfile(userId: string, email?: string): Promise<void> {
    const resolvedEmail = email?.trim() || `${userId}@users.expenseai.local`;

    await this.prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: resolvedEmail },
      update: email ? { email: resolvedEmail } : {},
    });
  }
}
