import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class MonthlyBudgetCategoryInput {
  @Field()
  key!: string;

  @Field(() => Int)
  amountCents!: number;
}

@InputType()
export class ExtraExpenseCutInput {
  @Field()
  key!: string;

  @Field(() => Int)
  cutPercent!: number;
}

@InputType()
export class ExtraExpenseInput {
  @Field()
  name!: string;

  @Field(() => Int)
  amountCents!: number;

  @Field(() => [ExtraExpenseCutInput])
  cuts!: ExtraExpenseCutInput[];
}

@InputType()
export class SaveMonthlyBudgetInput {
  @Field()
  currency!: string;

  @Field(() => [MonthlyBudgetCategoryInput])
  categories!: MonthlyBudgetCategoryInput[];

  @Field(() => ExtraExpenseInput, { nullable: true })
  extraExpense?: ExtraExpenseInput | null;
}
