export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD local date
  amount: number; // Integer minor units (e.g. cents, poisha, yen)
  type: TransactionType;
  category: string;
  description: string;
  createdAt: number;
  recurringRuleId?: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number; // Integer minor units
  rollover?: boolean; // If enabled, unspent budget carries over
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isCustom?: boolean;
}

export interface RecurringRule {
  id: string;
  frequency: 'weekly' | 'monthly';
  amount: number; // Integer minor units
  type: TransactionType;
  category: string;
  description: string;
  startDate: string;
  paused: boolean;
  lastGeneratedDate?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number; // Integer minor units
  currentAmount: number; // Integer minor units
  targetDate: string; // YYYY-MM-DD
  emoji: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  currency: string;
  theme: ThemePreference;
}

export interface PersistentData {
  schemaVersion: number;
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  recurringRules: RecurringRule[];
  savingsGoals: SavingsGoal[];
  settings: AppSettings;
}

export type FilterType = 'all' | 'income' | 'expense' | 'month' | 'custom';
export type SortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export interface ToastMessage {
  id: string;
  message: string;
  undoAction?: () => void;
  duration?: number;
}
