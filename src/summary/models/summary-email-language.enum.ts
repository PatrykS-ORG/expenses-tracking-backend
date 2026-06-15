import { registerEnumType } from '@nestjs/graphql';
import { SummaryEmailLanguage } from '../../generated/prisma/client';

export enum SummaryEmailLanguageEnum {
  PL = 'PL',
  EN = 'EN',
}

registerEnumType(SummaryEmailLanguageEnum, {
  name: 'SummaryEmailLanguage',
});

export function toSummaryEmailLanguageEnum(
  language: SummaryEmailLanguage,
): SummaryEmailLanguageEnum {
  return language === SummaryEmailLanguage.EN
    ? SummaryEmailLanguageEnum.EN
    : SummaryEmailLanguageEnum.PL;
}

export function fromSummaryEmailLanguageEnum(
  language: SummaryEmailLanguageEnum,
): SummaryEmailLanguage {
  return language === SummaryEmailLanguageEnum.EN
    ? SummaryEmailLanguage.EN
    : SummaryEmailLanguage.PL;
}
