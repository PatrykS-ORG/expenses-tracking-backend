import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ExpenseCategorySuggestion {
  @Field()
  name!: string;

  @Field()
  amount!: string;

  @Field()
  categoryKey!: string;
}

@ObjectType()
export class SuggestExpenseCategoriesResult {
  @Field(() => [ExpenseCategorySuggestion])
  suggestions!: ExpenseCategorySuggestion[];
}
