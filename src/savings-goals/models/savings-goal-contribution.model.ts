import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SavingsGoalContribution')
export class SavingsGoalContributionModel {
  @Field()
  id!: string;

  @Field(() => Int)
  amountCents!: number;

  @Field(() => Date)
  occurredOn!: Date;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field()
  createdAt!: Date;
}
