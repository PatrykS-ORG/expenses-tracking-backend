import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { SummaryAnalyticsSourceEnum } from './summary-analytics-source.enum';

@ObjectType()
export class SummaryCategoryItemModel {
  @Field()
  name!: string;

  @Field(() => Int)
  amountCents!: number;
}

@ObjectType()
export class SummaryCategoryModel {
  @Field()
  name!: string;

  @Field(() => Int)
  totalCents!: number;

  @Field(() => [SummaryCategoryItemModel])
  items!: SummaryCategoryItemModel[];
}

@ObjectType()
export class SummaryAnalyticsModel {
  @Field()
  id!: string;

  @Field()
  period!: string;

  @Field(() => SummaryAnalyticsSourceEnum)
  source!: SummaryAnalyticsSourceEnum;

  @Field()
  currency!: string;

  @Field(() => Int)
  salaryCents!: number;

  @Field(() => Int)
  totalExpensesCents!: number;

  @Field(() => Int)
  savingsCents!: number;

  @Field(() => String, { nullable: true })
  savingsMessage!: string | null;

  @Field(() => [SummaryCategoryModel])
  categories!: SummaryCategoryModel[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@InputType()
export class ManualSummaryCategoryItemInput {
  @Field()
  name!: string;

  @Field()
  amount!: string;
}

@InputType()
export class ManualSummaryCategoryInput {
  @Field()
  name!: string;

  @Field()
  total!: string;

  @Field(() => [ManualSummaryCategoryItemInput], { nullable: true })
  items?: ManualSummaryCategoryItemInput[];
}

@InputType()
export class CreateManualSummaryInput {
  @Field()
  period!: string;

  @Field()
  salaryAmount!: string;

  @Field(() => [ManualSummaryCategoryInput])
  categories!: ManualSummaryCategoryInput[];

  @Field(() => String, { nullable: true })
  savingsMessage?: string | null;
}

@InputType()
export class UpdateManualSummaryInput extends CreateManualSummaryInput {}
