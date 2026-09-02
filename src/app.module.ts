import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppResolver } from './app.resolver';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AiModule } from './ai/ai.module';
import { AiUsageModule } from './ai-usage/ai-usage.module';
import { PrismaModule } from './prisma/prisma.module';
import { TemplatesModule } from './templates/templates.module';
import { DataSourcesModule } from './data-sources/data-sources.module';
import { EmailModule } from './email/email.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { CronModule } from './cron/cron.module';
import { SummaryModule } from './summary/summary.module';
import { BudgetModule } from './budget/budget.module';
import { SavingsGoalsModule } from './savings-goals/savings-goals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), 'expenses-tracking-backend', '.env'),
      ],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile:
        process.env.NODE_ENV === 'production'
          ? true
          : join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      // Required so GqlAuthGuard / JwtStrategy can read Authorization from req
      context: ({ req }: { req: Request }) => ({ req }),
    }),
    PrismaModule,
    AuthModule,
    AiUsageModule,
    AiModule,
    TemplatesModule,
    DataSourcesModule,
    EmailModule,
    ReceiptsModule,
    SummaryModule,
    BudgetModule,
    SavingsGoalsModule,
    CronModule,
  ],
  providers: [AppService, AppResolver],
})
export class AppModule {}
