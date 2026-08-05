import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateTemplateInput {
  @Field()
  templateId!: string;

  @Field()
  name!: string;

  @Field()
  content!: string;
}
