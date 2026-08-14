import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CurrentMonthExpenseItemInput {
  @Field()
  name!: string;

  @Field()
  amount!: string;
}

@InputType()
export class CurrentMonthExpenseCategoryInput {
  @Field()
  key!: string;

  @Field(() => [CurrentMonthExpenseItemInput])
  items!: CurrentMonthExpenseItemInput[];
}

@InputType()
export class SaveCurrentMonthExpensesInput {
  @Field(() => [CurrentMonthExpenseCategoryInput])
  categories!: CurrentMonthExpenseCategoryInput[];

  @Field(() => [CurrentMonthExpenseItemInput])
  unassigned!: CurrentMonthExpenseItemInput[];
}
