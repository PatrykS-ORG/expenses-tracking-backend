import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import { ReceiptsService } from './receipts.service';
import { ApproveReceiptExpensesInput } from './dto/approve-receipt-expenses.input';
import { ScanReceiptInput } from './dto/scan-receipt.input';
import { ReceiptScanResult } from './models/receipt-scan-result.model';

interface AuthenticatedUser {
  sub?: string;
  id?: string;
  email?: string;
}

@Resolver()
export class ReceiptsResolver {
  constructor(private readonly receiptsService: ReceiptsService) {}

  private extractUserId(user: AuthenticatedUser): string {
    const userId = user.sub ?? user.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user identifier');
    }
    return userId;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  async approveReceiptExpenses(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: ApproveReceiptExpensesInput,
  ): Promise<boolean> {
    return this.receiptsService.approveReceiptExpenses(
      this.extractUserId(user),
      user.email,
      input.text,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ReceiptScanResult)
  async scanReceipt(
    @Args('input') input: ScanReceiptInput,
  ): Promise<ReceiptScanResult> {
    return this.receiptsService.scanReceipt(input);
  }
}
