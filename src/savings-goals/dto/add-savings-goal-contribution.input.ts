import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class AddSavingsGoalContributionInput {
  @Field(() => Int)
  amountCents!: number;

  @Field(() => Date)
  occurredOn!: Date;

  @Field(() => String, { nullable: true })
  note?: string | null;
}
