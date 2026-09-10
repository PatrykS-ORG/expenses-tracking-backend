import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('MonthClosureStatus')
export class MonthClosureStatusModel {
  @Field()
  needsClosure!: boolean;

  @Field()
  period!: string;

  @Field()
  currentPeriod!: string;

  @Field(() => Int)
  freeSavingsCents!: number;

  @Field(() => Int)
  salaryCents!: number;

  @Field(() => Int)
  totalExpensesCents!: number;

  @Field()
  currency!: string;
}
