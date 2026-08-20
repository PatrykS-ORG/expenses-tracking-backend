import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('MonthlyBudgetCategory')
export class MonthlyBudgetCategoryModel {
  @Field()
  key!: string;

  @Field(() => Int)
  amountCents!: number;
}

@ObjectType('ExtraExpenseCut')
export class ExtraExpenseCutModel {
  @Field()
  key!: string;

  @Field(() => Int)
  cutPercent!: number;
}

@ObjectType('ExtraExpense')
export class ExtraExpenseModel {
  @Field()
  name!: string;

  @Field(() => Int)
  amountCents!: number;

  @Field(() => [ExtraExpenseCutModel])
  cuts!: ExtraExpenseCutModel[];
}

@ObjectType('MonthlyBudget')
export class MonthlyBudgetModel {
  @Field()
  id!: string;

  @Field()
  currency!: string;

  @Field(() => [MonthlyBudgetCategoryModel])
  categories!: MonthlyBudgetCategoryModel[];

  @Field(() => ExtraExpenseModel, { nullable: true })
  extraExpense!: ExtraExpenseModel | null;

  @Field()
  updatedAt!: Date;
}
