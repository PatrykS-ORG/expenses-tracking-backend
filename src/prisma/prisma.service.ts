import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

const SSL_URL_PARAMS = ['sslmode', 'sslaccept', 'sslrootcert', 'sslcert', 'sslkey'];

function buildPgPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  try {
    const url = new URL(connectionString);
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const sslDisabled = url.searchParams.get('sslmode') === 'disable';

    for (const param of SSL_URL_PARAMS) {
      url.searchParams.delete(param);
    }

    const config: PoolConfig = { connectionString: url.toString() };

    if (!isLocal && !sslDisabled) {
      // Prisma 7 uses node-pg; pg 8 treats sslmode=require as verify-full, which
      // overrides Pool.ssl. Strip URL SSL params and set ssl on the pool instead.
      config.ssl = {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
      };
    }

    return config;
  } catch {
    return {
      connectionString,
      ssl: {
        rejectUnauthorized:
          process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
      },
    };
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaPg(buildPgPoolConfig());
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
