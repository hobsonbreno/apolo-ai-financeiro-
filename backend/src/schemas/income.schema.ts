import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IncomeDocument = Income & Document;

@Schema({ timestamps: true })
export class Income {
  @Prop({ required: true })
  userPhone: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  amount: number;

  @Prop()
  categoryName: string;

  @Prop({ default: Date.now })
  date: Date;
}

export const IncomeSchema = SchemaFactory.createForClass(Income);
