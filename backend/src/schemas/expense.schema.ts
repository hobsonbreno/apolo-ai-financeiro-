import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpenseDocument = Expense & Document;

@Schema({ timestamps: true })
export class Expense {
  @Prop({ required: true })
  userPhone: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId: Types.ObjectId;

  @Prop()
  categoryName: string;

  @Prop({ default: Date.now })
  date: Date;

  @Prop({ default: false })
  recurring: boolean;

  @Prop({ default: 1 })
  installments: number;

  @Prop({ default: 'cash' }) // cash, debit, credit
  paymentMethod: string;

  @Prop()
  installmentIndex: number; // 1, 2, 3...
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
