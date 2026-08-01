import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { AiActionTypeEnum } from './ai-action-type.enum';
import { AiUsageTriggerEnum } from './ai-usage-trigger.enum';

@ObjectType()
export class AiUsageLogEntry {
  @Field(() => ID)
  id!: string;

  @Field(() => AiActionTypeEnum)
  action!: AiActionTypeEnum;

  @Field(() => AiUsageTriggerEnum)
  trigger!: AiUsageTriggerEnum;

  @Field()
  model!: string;

  @Field(() => Int)
  promptTokens!: number;

  @Field(() => Int)
  completionTokens!: number;

  @Field(() => Int)
  totalTokens!: number;

  @Field(() => Int)
  creditsUsed!: number;

  @Field()
  success!: boolean;

  @Field(() => String, { nullable: true })
  errorMessage?: string | null;

  @Field()
  createdAt!: Date;
}
