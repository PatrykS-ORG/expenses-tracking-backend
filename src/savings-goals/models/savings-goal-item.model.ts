import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SavingsGoalContributionModel } from './savings-goal-contribution.model';

@ObjectType('SavingsGoalItem')
export class SavingsGoalItemModel {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field(() => Int)
  targetAmountCents!: number;

  @Field(() => Date, { nullable: true })
  targetDate!: Date | null;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => Int)
  savedCents!: number;

  @Field(() => Int)
  remainingCents!: number;

  @Field(() => Int)
  progressPercent!: number;

  @Field(() => Int, { nullable: true })
  monthlySuggestionCents!: number | null;

  @Field(() => [SavingsGoalContributionModel])
  contributions!: SavingsGoalContributionModel[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
