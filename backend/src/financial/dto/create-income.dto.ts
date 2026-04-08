import { ApiProperty } from '@nestjs/swagger';

export class CreateIncomeDto {
  @ApiProperty({ example: '5511999999999' })
  phone: string;

  @ApiProperty({ example: 'Salário' })
  description: string;

  @ApiProperty({ example: 5000 })
  amount: number;

  @ApiProperty({ example: 'Trabalho', required: false })
  categoryName?: string;
}
