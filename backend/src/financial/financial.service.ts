import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from '../schemas/expense.schema';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Income, IncomeDocument } from '../schemas/income.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import axios from 'axios';

@Injectable()
export class FinancialService {
  private readonly logger = new Logger(FinancialService.name);
  private currentQrCode: string | null = null;
  private isConnected: boolean = false;

  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Income.name) private incomeModel: Model<IncomeDocument>,
  ) {}

  async getUserStatus(phone: string): Promise<User> {
    let user = await this.userModel.findOne({ phone }).exec();
    
    if (!user) {
      // Create new trial user
      user = new this.userModel({
        phone,
        status: 'trial',
        subscriptionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days trial
      });
      await user.save();
    }
    
    return user;
  }

  async createExpense(dto: any): Promise<Expense | Expense[]> {
    const { phone, ...expenseData } = dto;
    await this.getUserStatus(phone);

    // AI Categorization if missing
    if (!expenseData.categoryName || expenseData.categoryName === 'Outros') {
      try {
        const aiUrl = process.env.PYTHON_URL || 'http://ai-engine:8000';
        const aiResponse = await axios.post(`${aiUrl}/analyze`, {
            description: expenseData.description,
            amount: expenseData.amount
        });
        expenseData.categoryName = aiResponse.data.category;
      } catch (error) {
        expenseData.categoryName = 'Outros';
      }
    }

    const installments = expenseData.installments || 1;
    
    if (installments > 1) {
      const createdExpenses = [];
      const baseDate = expenseData.date ? new Date(expenseData.date) : new Date();
      
      for (let i = 1; i <= installments; i++) {
        const installmentDate = new Date(baseDate);
        installmentDate.setMonth(baseDate.getMonth() + (i - 1));
        
        const expense = new this.expenseModel({
          ...expenseData,
          userPhone: phone,
          description: `${expenseData.description} (${i}/${installments})`,
          date: installmentDate,
          installmentIndex: i,
          installments: installments
        });
        
        createdExpenses.push(await expense.save());
        await this.userModel.findOneAndUpdate({ phone }, { $inc: { totalSpent: expenseData.amount } });
      }
      return createdExpenses;
    }

    const createdExpense = new this.expenseModel({ ...expenseData, userPhone: phone });
    await this.userModel.findOneAndUpdate({ phone }, { $inc: { totalSpent: expenseData.amount } });
    return createdExpense.save();
  }

  async createIncome(dto: any): Promise<Income | Income[]> {
    const { phone, ...incomeData } = dto;
    await this.getUserStatus(phone);

    const installments = incomeData.installments || 1;
    
    if (installments > 1) {
      const createdIncomes = [];
      const baseDate = incomeData.date ? new Date(incomeData.date) : new Date();
      
      for (let i = 1; i <= installments; i++) {
        const installmentDate = new Date(baseDate);
        installmentDate.setMonth(baseDate.getMonth() + (i - 1));
        
        const income = new this.incomeModel({
          ...incomeData,
          userPhone: phone,
          description: `${incomeData.description} (Receita ${i}/${installments})`,
          date: installmentDate,
          installmentIndex: i,
          installments: installments
        });
        
        createdIncomes.push(await income.save());
        await this.userModel.findOneAndUpdate({ phone }, { $inc: { totalIncome: incomeData.amount } });
      }
      return createdIncomes;
    }

    const createdIncome = new this.incomeModel({ ...incomeData, userPhone: phone });
    await this.userModel.findOneAndUpdate({ phone }, { $inc: { totalIncome: incomeData.amount } });
    return createdIncome.save();
  }

  async findAllExpenses(phone: string): Promise<Expense[]> {
    return this.expenseModel.find({ userPhone: phone }).sort({ date: -1 }).exec();
  }

  async findAllIncome(phone: string): Promise<Income[]> {
    return this.incomeModel.find({ userPhone: phone }).sort({ date: -1 }).exec();
  }

  async getSummary(phone: string) {
    const expenses = await this.expenseModel.find({ userPhone: phone }).exec();
    const incomes = await this.incomeModel.find({ userPhone: phone }).exec();

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);

    return {
      totalExpenses,
      totalIncome,
      balance: totalIncome - totalExpenses,
      expenseCount: expenses.length,
      incomeCount: incomes.length,
    };
  }

  async updateSubscription(phone: string, durationDays: number, licenseKey: string) {
    const user = await this.userModel.findOne({ phone }).exec();
    if (user) {
      user.status = 'active';
      user.subscriptionExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      user.licenseKey = licenseKey;
      return user.save();
    }
    throw new Error('User not found');
  }

  setQrCode(qr: string) {
    this.currentQrCode = qr;
    this.isConnected = false;
  }

  getQrCode(): string | null {
    return this.currentQrCode;
  }

  setConnected(status: boolean) {
    this.isConnected = status;
    if (status) this.currentQrCode = null;
  }

  getConnected(): boolean {
    return this.isConnected;
  }
  async getProjection(phone: string) {
    const expenses = await this.expenseModel.find({ userPhone: phone }).exec();
    const incomes = await this.incomeModel.find({ userPhone: phone }).exec();

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();

    const projection = months.map((name, index) => {
      const monthExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });

      const monthIncomes = incomes.filter(i => {
        const d = new Date(i.date);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });

      // Detalhes por categoria/descrição
      const details = [
        ...monthIncomes.map(i => ({ name: i.description, amount: i.amount, type: 'income' })),
        ...monthExpenses.map(e => ({ name: e.description, amount: e.amount, type: 'expense' }))
      ];

      return {
        month: name,
        expenses: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
        income: monthIncomes.reduce((sum, i) => sum + i.amount, 0),
        details: details
      };
    });

    // Calcular Saldo Acumulado
    let cumulative = 0;
    const finalProjection = projection.map(p => {
      const balance = p.income - p.expenses;
      cumulative += balance;
      return { ...p, balance, cumulative };
    });

    return finalProjection;
  }

  async deleteExpense(id: string, allInstallments: boolean = false) {
    const expense = await this.expenseModel.findById(id).exec();
    if (!expense) throw new Error('Expense not found');

    if (allInstallments && expense.description.includes('(')) {
      const baseDesc = expense.description.split(' (')[0];
      return this.expenseModel.deleteMany({
        userPhone: expense.userPhone,
        description: { $regex: new RegExp('^' + baseDesc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }
      }).exec();
    }
    return this.expenseModel.findByIdAndDelete(id).exec();
  }

  async updateExpense(id: string, update: any, allInstallments: boolean = false) {
    const expense = await this.expenseModel.findById(id).exec();
    if (!expense) throw new Error('Expense not found');

    if (allInstallments && expense.description.includes('(')) {
      const baseDesc = expense.description.split(' (')[0];
      const { date, ...otherUpdates } = update;
      return this.expenseModel.updateMany(
        {
          userPhone: expense.userPhone,
          description: { $regex: new RegExp('^' + baseDesc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }
        },
        { $set: otherUpdates }
      ).exec();
    }
    return this.expenseModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async deleteIncome(id: string, allInstallments: boolean = false) {
    const income = await this.incomeModel.findById(id).exec();
    if (!income) throw new Error('Income not found');

    if (allInstallments && income.description.includes('(')) {
      const baseDesc = income.description.split(' (')[0];
      return this.incomeModel.deleteMany({
        userPhone: income.userPhone,
        description: { $regex: new RegExp('^' + baseDesc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }
      }).exec();
    }
    return this.incomeModel.findByIdAndDelete(id).exec();
  }

  async updateIncome(id: string, update: any, allInstallments: boolean = false) {
    const income = await this.incomeModel.findById(id).exec();
    if (!income) throw new Error('Income not found');

    if (allInstallments && income.description.includes('(')) {
      const baseDesc = income.description.split(' (')[0];
      const { date, ...otherUpdates } = update;
      return this.incomeModel.updateMany(
        {
          userPhone: income.userPhone,
          description: { $regex: new RegExp('^' + baseDesc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }
        },
        { $set: otherUpdates }
      ).exec();
    }
    return this.incomeModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }
}
