import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { SummaryEmailLanguageEnum } from './summary-email-language.enum';

@ObjectType()
export class SummarySchedule {
  @Field()
  enabled: boolean;

  @Field(() => Int)
  scheduleDay: number;

  @Field(() => Int)
  scheduleHour: number;

  @Field()
  timezone: string;

  @Field(() => SummaryEmailLanguageEnum)
  emailLanguage: SummaryEmailLanguageEnum;

  @Field(() => Date, { nullable: true })
  nextSummaryAt: Date | null;
}

@InputType()
export class UpdateSummaryScheduleInput {
  @Field()
  enabled: boolean;

  @Field(() => Int)
  scheduleDay: number;

  @Field(() => Int)
  scheduleHour: number;

  @Field()
  timezone: string;

  @Field(() => SummaryEmailLanguageEnum)
  emailLanguage: SummaryEmailLanguageEnum;
}
