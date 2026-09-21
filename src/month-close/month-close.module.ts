import {
  MiddlewareConsumer,
  Module,
  NestModule,
  forwardRef,
} from '@nestjs/common';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { UsersModule } from '../users/users.module';
import { MonthCloseNowMiddleware } from './month-close-now.middleware';
import { MonthCloseClock } from './month-close.clock.service';
import { MonthCloseResolver } from './month-close.resolver';
import { MonthCloseService } from './month-close.service';

@Module({
  imports: [UsersModule, forwardRef(() => DataSourcesModule)],
  providers: [MonthCloseClock, MonthCloseService, MonthCloseResolver],
  exports: [MonthCloseService],
})
export class MonthCloseModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MonthCloseNowMiddleware).forRoutes('*');
  }
}
