import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class MonthlyBudgetCategoryInput {
  @Field()
  key!: string;

  @Field(() => Int)
  amountCents!: number;
}

@InputType()
export class SaveMonthlyBudgetInput {
  @Field()
  currency!: string;

  @Field(() => [MonthlyBudgetCategoryInput])
  categories!: MonthlyBudgetCategoryInput[];
}
