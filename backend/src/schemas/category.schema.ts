import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema()
export class Category {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['expense', 'income'] })
  type: string;

  @Prop()
  budgetLimit: number;

  @Prop()
  color: string;

  @Prop()
  icon: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
