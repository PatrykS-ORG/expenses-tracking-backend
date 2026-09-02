import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateSavingsGoalItemInput {
  @Field()
  name!: string;

  @Field(() => Int)
  targetAmountCents!: number;

  @Field(() => Date, { nullable: true })
  targetDate?: Date | null;
}

@InputType()
export class UpdateSavingsGoalItemInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => Int, { nullable: true })
  targetAmountCents?: number;

  @Field(() => Date, { nullable: true })
  targetDate?: Date | null;
}
