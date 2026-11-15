import type { Category } from './types.ts';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food & Dining', emoji: '🍔', color: '#F5A623' },
  { id: 'transport', name: 'Transportation', emoji: '🚗', color: '#4A90E2' },
  { id: 'housing', name: 'Housing & Rent', emoji: '🏠', color: '#9013FE' },
  { id: 'utilities', name: 'Utilities', emoji: '⚡', color: '#F8E71C' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎮', color: '#BD10E0' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#E8452C' },
  { id: 'health', name: 'Health & Medical', emoji: '💊', color: '#50E3C2' },
  { id: 'education', name: 'Education', emoji: '📚', color: '#B8E986' },
  { id: 'groceries', name: 'Groceries', emoji: '🛒', color: '#7ED321' },
  { id: 'salary', name: 'Salary', emoji: '💼', color: '#1FAB6E' },
  { id: 'freelance', name: 'Freelance', emoji: '💻', color: '#3D3AFF' },
  { id: 'investment', name: 'Investment', emoji: '📈', color: '#00D2D3' },
  { id: 'gift', name: 'Gift', emoji: '🎁', color: '#FF9FF3' },
  { id: 'other', name: 'Other', emoji: '📦', color: '#8395A7' },
];

export const CURRENT_SCHEMA_VERSION = 2;
export const STORAGE_KEY_V2 = 'flo_app_data_v2';
export const LEGACY_STORAGE_KEY_STATE = 'flo_state';
export const LEGACY_STORAGE_KEY_THEME = 'flo_theme';
