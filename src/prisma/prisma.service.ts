import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    // pg treats ssl-related URL params as higher priority than the ssl object.
    // Remove them so our explicit TLS options are always applied.
    let normalizedConnectionString = connectionString;
    try {
      const parsedUrl = new URL(connectionString);
      parsedUrl.searchParams.delete('sslmode');
      parsedUrl.searchParams.delete('sslcert');
      parsedUrl.searchParams.delete('sslkey');
      parsedUrl.searchParams.delete('sslrootcert');
      normalizedConnectionString = parsedUrl.toString();
    } catch {
      normalizedConnectionString = connectionString;
    }

    const rejectUnauthorized =
      configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED') === 'true';

    const adapter = new PrismaPg({
      connectionString: normalizedConnectionString,
      ssl: { rejectUnauthorized },
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
