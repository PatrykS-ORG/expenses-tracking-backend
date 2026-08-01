import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import {
  extractUserId,
  type AuthenticatedUser,
} from '../auth/authenticated-user';
import { ReceiptsService } from './receipts.service';
import { ApproveReceiptExpensesInput } from './dto/approve-receipt-expenses.input';
import { ScanReceiptInput } from './dto/scan-receipt.input';
import { ReceiptScanResult } from './models/receipt-scan-result.model';

@Resolver()
export class ReceiptsResolver {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  async approveReceiptExpenses(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: ApproveReceiptExpensesInput,
  ): Promise<boolean> {
    return this.receiptsService.approveReceiptExpenses(
      extractUserId(user),
      user.email,
      input.text,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ReceiptScanResult)
  async scanReceipt(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: ScanReceiptInput,
  ): Promise<ReceiptScanResult> {
    return this.receiptsService.scanReceipt(
      extractUserId(user),
      user.email,
      input,
    );
  }
}
