import { registerEnumType } from '@nestjs/graphql';

export enum SummaryAnalyticsSourceEnum {
  SCHEDULED = 'SCHEDULED',
  MANUAL = 'MANUAL',
}

registerEnumType(SummaryAnalyticsSourceEnum, {
  name: 'SummaryAnalyticsSource',
});
