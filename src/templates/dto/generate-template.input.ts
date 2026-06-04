import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class GenerateTemplateInput {
  @Field()
  tone: string;

  @Field()
  detailLevel: string;

  @Field()
  focus: string;

  @Field()
  visualStyle: string;
}
