import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateNextcloudFilePathInput {
  @Field()
  nextcloudFilePath!: string;
}
