import { registerEnumType } from '@nestjs/graphql';

export enum AiActionTypeEnum {
  TEMPLATE_GENERATION = 'TEMPLATE_GENERATION',
  EXPENSE_SUMMARY = 'EXPENSE_SUMMARY',
  RECEIPT_SCAN = 'RECEIPT_SCAN',
}

registerEnumType(AiActionTypeEnum, {
  name: 'AiActionType',
});
