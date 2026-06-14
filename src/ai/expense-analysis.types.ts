export interface ExpenseCategoryItem {
  name: string;
  amount: string;
}

export interface ExpenseCategory {
  name: string;
  total: string;
  items: ExpenseCategoryItem[];
}

export interface ExpenseAnalysisResult {
  userName: string;
  currentMonth: string;
  salaryAmount: string;
  totalExpenses: string;
  savingsAmount: string;
  savingsMessage: string;
  categories: ExpenseCategory[];
}
