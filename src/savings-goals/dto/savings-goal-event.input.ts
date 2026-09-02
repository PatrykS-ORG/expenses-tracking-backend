import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateSavingsGoalEventInput {
  @Field()
  name!: string;

  @Field({ nullable: true })
  currency?: string;

  @Field(() => Date, { nullable: true })
  targetDate?: Date | null;
}

@InputType()
export class UpdateSavingsGoalEventInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  currency?: string;

  @Field(() => Date, { nullable: true })
  targetDate?: Date | null;
}
