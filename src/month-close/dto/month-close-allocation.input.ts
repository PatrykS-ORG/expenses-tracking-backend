import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class MonthCloseAllocationInput {
  @Field()
  itemId!: string;

  @Field(() => Int)
  amountCents!: number;
}
