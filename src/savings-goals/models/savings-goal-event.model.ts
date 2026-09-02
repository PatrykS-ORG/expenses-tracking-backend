import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SavingsGoalItemModel } from './savings-goal-item.model';

@ObjectType('SavingsGoalEvent')
export class SavingsGoalEventModel {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  currency!: string;

  @Field(() => Date, { nullable: true })
  targetDate!: Date | null;

  @Field(() => Int)
  totalTargetCents!: number;

  @Field(() => Int)
  totalSavedCents!: number;

  @Field(() => Int)
  progressPercent!: number;

  @Field(() => [SavingsGoalItemModel])
  items!: SavingsGoalItemModel[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
