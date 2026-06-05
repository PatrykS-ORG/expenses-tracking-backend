import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SendTestEmailInput {
  @Field()
  recipientEmail: string;
}
