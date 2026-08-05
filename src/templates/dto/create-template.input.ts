import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateTemplateInput {
  @Field()
  name!: string;

  @Field()
  content!: string;
}
