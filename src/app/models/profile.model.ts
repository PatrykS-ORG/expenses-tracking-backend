import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ProfileUser {
  @Field()
  id: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  roles?: string;
}

@ObjectType()
export class Profile {
  @Field()
  message: string;

  @Field(() => ProfileUser)
  user: ProfileUser;
}
