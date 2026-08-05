import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ExpenseFileUploadInput {
  @Field()
  fileName!: string;

  @Field()
  mimeType!: string;

  @Field()
  contentBase64!: string;
}
