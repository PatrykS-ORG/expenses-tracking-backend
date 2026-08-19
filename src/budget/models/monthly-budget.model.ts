import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('MonthlyBudgetCategory')
export class MonthlyBudgetCategoryModel {
  @Field()
  key!: string;

  @Field(() => Int)
  amountCents!: number;
}

@ObjectType('MonthlyBudget')
export class MonthlyBudgetModel {
  @Field()
  id!: string;

  @Field()
  currency!: string;

  @Field(() => [MonthlyBudgetCategoryModel])
  categories!: MonthlyBudgetCategoryModel[];

  @Field()
  updatedAt!: Date;
}
