import { UseGuards } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import {
  extractUserId,
  type AuthenticatedUser,
} from '../auth/authenticated-user';
import { UserProfileService } from './user-profile.service';

@Resolver()
export class UsersResolver {
  constructor(private readonly userProfileService: UserProfileService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteMyAccount(@CurrentUserGql() user: AuthenticatedUser): Promise<boolean> {
    return this.userProfileService.deleteAccount(extractUserId(user));
  }
}
