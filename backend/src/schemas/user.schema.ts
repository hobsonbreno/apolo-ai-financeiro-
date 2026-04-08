import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop()
  name: string;

  @Prop({ default: 'trial' }) // active, blocked, trial
  status: string;

  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop({ unique: true, sparse: true })
  cpf: string;

  @Prop()
  password: string;

  @Prop()
  avatarUrl: string;

  @Prop({ default: 'user' }) // user, admin
  role: string;

  @Prop({ default: true }) 
  lgpd_consent: boolean;

  @Prop({ default: 'free' }) // free, premium
  plan: string;

  @Prop()
  subscriptionExpiry: Date;

  @Prop()
  birthday: Date;

  @Prop()
  licenseKey: string;

  @Prop({ default: 0 })
  totalSpent: number;

  @Prop({ default: 0 })
  totalIncome: number;

  @Prop()
  recoveryToken: string;

  @Prop()
  recoveryExpiry: Date;

  @Prop()
  cep: string;

  @Prop()
  address: string;

  @Prop()
  addressNumber: string;

  @Prop()
  city: string;

  @Prop()
  state: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
