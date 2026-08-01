import { registerEnumType } from '@nestjs/graphql';

export enum AiUsageTriggerEnum {
  MANUAL = 'MANUAL',
  SCHEDULED = 'SCHEDULED',
}

registerEnumType(AiUsageTriggerEnum, {
  name: 'AiUsageTrigger',
});
