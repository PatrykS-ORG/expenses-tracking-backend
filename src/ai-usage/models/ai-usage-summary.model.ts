import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class AiUsageSummary {
  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  used!: number;

  @Field(() => Int)
  remaining!: number;

  @Field()
  periodStart!: Date;

  @Field()
  periodEnd!: Date;
}
