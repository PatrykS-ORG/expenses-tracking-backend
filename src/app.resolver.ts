import { Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { GqlAuthGuard } from './auth/gql-auth.guard';
import { CurrentUserGql } from './auth/current-user.graphql.decorator';
import { Profile, ProfileUser } from './app/models/profile.model';

interface AuthenticatedUser {
  id?: string;
  email?: string;
  roles?: string;
}

@Resolver()
export class AppResolver {
  constructor(private readonly appService: AppService) {}

  @Query(() => String)
  health(): string {
    return this.appService.getHello();
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Profile)
  myProfile(@CurrentUserGql() user: AuthenticatedUser): Profile {
    return {
      message: 'Udało Ci się pomyślnie zautoryzować!',
      user: {
        id: user.id ?? '',
        email: user.email,
        roles: user.roles,
      } satisfies ProfileUser,
    };
  }
}
