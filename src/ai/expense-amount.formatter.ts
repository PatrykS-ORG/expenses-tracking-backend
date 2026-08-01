import { SummaryEmailLanguage } from '../generated/prisma/client';

export function amountToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}

function formatNumberParts(
  cents: number,
  thousandsSeparator: string,
  decimalSeparator: string,
): string {
  const negative = cents < 0;
  const absoluteCents = Math.abs(cents);
  const whole = Math.floor(absoluteCents / 100).toString();
  const fraction = (absoluteCents % 100).toString().padStart(2, '0');
  const groupedWhole = whole.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    thousandsSeparator,
  );

  return `${negative ? '-' : ''}${groupedWhole}${decimalSeparator}${fraction}`;
}

export function formatMoneyAmount(
  cents: number,
  language: SummaryEmailLanguage,
  currency: string,
): string {
  const normalizedCurrency = currency.trim().toUpperCase() || 'PLN';
  const isEnglish = language === SummaryEmailLanguage.EN;

  const formatted = isEnglish
    ? formatNumberParts(cents, ',', '.')
    : formatNumberParts(cents, ' ', ',');

  if (!isEnglish && normalizedCurrency === 'PLN') {
    return `${formatted} zł`;
  }

  return `${formatted} ${normalizedCurrency}`;
}
