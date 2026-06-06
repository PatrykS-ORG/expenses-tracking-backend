import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ApproveReceiptExpensesInput {
  @Field()
  text: string;
}
