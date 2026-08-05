import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Template {
  @Field(() => ID)
  id!: string;

  @Field()
  user_id!: string;

  @Field()
  name!: string;

  @Field()
  content!: string;

  @Field()
  created_at!: Date;
}
