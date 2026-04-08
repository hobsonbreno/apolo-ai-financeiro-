import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({ example: '5511999999999' })
  phone: string;

  @ApiProperty({ example: 'Mercado' })
  description: string;

  @ApiProperty({ example: 150.50 })
  amount: number;

  @ApiProperty({ example: 'Alimentação', required: false })
  categoryName?: string;

  @ApiProperty({ example: '2024-03-20', required: false })
  date?: Date;
}
