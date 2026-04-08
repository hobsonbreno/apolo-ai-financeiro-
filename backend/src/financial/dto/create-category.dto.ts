export class CreateCategoryDto {
  name: string;
  type: 'expense' | 'income';
  budgetLimit?: number;
  color?: string;
  icon?: string;
}
