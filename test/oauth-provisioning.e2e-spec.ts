import { Test, TestingModule } from '@nestjs/testing';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { GraphQLModule, GqlExecutionContext } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import request from 'supertest';
import { App } from 'supertest/types';
import { SummaryResolver } from '../src/summary/summary.resolver';
import { SummaryService } from '../src/summary/summary.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiService } from '../src/ai/ai.service';
import { EmailService } from '../src/email/email.service';
import { DataSourceResolverService } from '../src/data-sources/data-source-resolver.service';
import { UserProfileService } from '../src/users/user-profile.service';
import { GqlAuthGuard } from '../src/auth/gql-auth.guard';

interface UserScheduleRecord {
  id: string;
  email: string;
  summary_enabled: boolean;
  summary_schedule_day: number;
  summary_schedule_hour: number;
  summary_timezone: string;
  summary_email_language: 'PL' | 'EN';
  next_summary_at: Date | null;
}

describe('OAuth provisioning (GraphQL e2e)', () => {
  let app: INestApplication<App>;
  const usersById = new Map<string, UserScheduleRecord>();

  const prismaMock = {
    user: {
      upsert: jest.fn(
        (args: {
          where: { id: string };
          create: { id: string; email: string };
          update: { email?: string };
        }) => {
          const existing = usersById.get(args.where.id);
          if (existing) {
            const updated: UserScheduleRecord = {
              ...existing,
              ...(args.update.email ? { email: args.update.email } : {}),
            };
            usersById.set(args.where.id, updated);
            return updated;
          }

          const created: UserScheduleRecord = {
            id: args.create.id,
            email: args.create.email,
            summary_enabled: false,
            summary_schedule_day: 1,
            summary_schedule_hour: 8,
            summary_timezone: 'Europe/Warsaw',
            summary_email_language: 'PL',
            next_summary_at: null,
          };
          usersById.set(created.id, created);
          return created;
        },
      ),
      findUnique: jest.fn(
        (args: { where: { id: string }; select?: Record<string, boolean> }) => {
          const user = usersById.get(args.where.id);
          if (!user) {
            return null;
          }
          if (!args.select) {
            return user;
          }

          const selected: Record<string, unknown> = {};
          for (const [field, enabled] of Object.entries(args.select)) {
            if (enabled) {
              selected[field] = user[field as keyof UserScheduleRecord];
            }
          }
          return selected;
        },
      ),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    summaryLog: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const authGuardMock: CanActivate = {
    canActivate(context: ExecutionContext): boolean {
      const gqlContext = GqlExecutionContext.create(context).getContext<{
        req: {
          headers: { authorization?: string };
          user?: { sub: string; email: string };
        };
      }>();
      const authHeader = gqlContext.req.headers.authorization;
      if (authHeader !== 'Bearer oauth-test-token') {
        throw new UnauthorizedException();
      }

      gqlContext.req.user = {
        sub: 'oauth-user-1',
        email: 'google.user@example.com',
      };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    usersById.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          context: ({ req }: { req: unknown }) => ({ req }),
        }),
      ],
      providers: [
        SummaryResolver,
        SummaryService,
        UserProfileService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AiService, useValue: { analyzeExpenses: jest.fn() } },
        { provide: EmailService, useValue: { sendEmail: jest.fn() } },
        {
          provide: DataSourceResolverService,
          useValue: { fetchExpenseContent: jest.fn() },
        },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue(authGuardMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves summary schedule for first OAuth request by provisioning profile', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer oauth-test-token')
      .send({
        query: `
          query {
            mySummarySchedule {
              enabled
              scheduleDay
              scheduleHour
              timezone
              emailLanguage
              nextSummaryAt
            }
          }
        `,
      })
      .expect(200);

    const body = response.body as {
      data: {
        mySummarySchedule: {
          enabled: boolean;
          scheduleDay: number;
          scheduleHour: number;
          timezone: string;
          emailLanguage: string;
          nextSummaryAt: string | null;
        };
      };
    };

    expect(body.data.mySummarySchedule).toEqual({
      enabled: false,
      scheduleDay: 1,
      scheduleHour: 8,
      timezone: 'Europe/Warsaw',
      emailLanguage: 'PL',
      nextSummaryAt: null,
    });

    expect(prismaMock.user.upsert).toHaveBeenCalledWith({
      where: { id: 'oauth-user-1' },
      create: { id: 'oauth-user-1', email: 'google.user@example.com' },
      update: { email: 'google.user@example.com' },
    });
  });
});
