import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class ScanReceiptInput {
  @Field()
  fileName: string;

  @Field()
  mimeType: string;

  @Field()
  contentBase64: string;
}
