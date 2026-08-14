import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CurrentMonthExpenseItem {
  @Field()
  name!: string;

  @Field()
  amount!: string;
}

@ObjectType()
export class CurrentMonthExpenseCategory {
  @Field()
  key!: string;

  @Field(() => [CurrentMonthExpenseItem])
  items!: CurrentMonthExpenseItem[];
}

@ObjectType()
export class CurrentMonthExpenses {
  @Field(() => [CurrentMonthExpenseCategory])
  categories!: CurrentMonthExpenseCategory[];

  @Field(() => [CurrentMonthExpenseItem])
  unassigned!: CurrentMonthExpenseItem[];
}
