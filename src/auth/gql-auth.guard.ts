import {
  Injectable,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(GqlAuthGuard.name);

  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext<{ req: unknown }>();
    return gqlContext.req;
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      this.logger.warn(
        `JWT auth failed: ${this.authFailureMessage(err, info)}`,
      );
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    return user;
  }

  private authFailureMessage(err: unknown, info: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (info instanceof Error) {
      return info.message;
    }
    if (typeof info === 'string') {
      return info;
    }
    if (
      info &&
      typeof info === 'object' &&
      'message' in info &&
      typeof info.message === 'string'
    ) {
      return info.message;
    }
    return 'no user';
  }
}
