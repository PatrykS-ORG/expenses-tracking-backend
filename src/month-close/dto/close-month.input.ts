import { Field, InputType } from '@nestjs/graphql';
import { MonthCloseAllocationInput } from './month-close-allocation.input';

@InputType()
export class CloseMonthInput {
  @Field()
  period!: string;

  @Field(() => [MonthCloseAllocationInput])
  allocations!: MonthCloseAllocationInput[];

  @Field(() => String, { nullable: true })
  testNow?: string | null;
}
