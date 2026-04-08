import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Expense, ExpenseDocument } from '../schemas/expense.schema';
import { Setting, SettingDocument } from '../schemas/setting.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
  ) {}

  async resetTrial(phone: string) {
    const trialExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.userModel.findOneAndUpdate(
      { phone }, 
      { status: 'trial', plan: 'free', subscriptionExpiry: trialExpiry }, 
      { new: true }
    ).exec();
  }

  async getAllUsers() {
    return this.userModel.find().sort({ createdAt: -1 }).exec();
  }

  async getUsersByStatus(status: string) {
    return this.userModel.find({ status }).sort({ createdAt: -1 }).exec();
  }

  async setUserStatus(phone: string, status: string, plan: string = 'free') {
    return this.userModel.findOneAndUpdate({ phone }, { status, plan }, { new: true }).exec();
  }

  async updateUserExpiry(phone: string, expiry: Date) {
    return this.userModel.findOneAndUpdate({ phone }, { subscriptionExpiry: expiry }, { new: true }).exec();
  }

  async cancelSubscription(phone: string) {
    const user = await this.userModel.findOne({ phone }).exec();
    if (!user || user.status !== 'active') throw new Error('Assinatura não está ativa');

    // Cálculo de multa: 10% do valor restante (exemplo fictício baseado em contrato)
    const now = new Date();
    const expiry = new Date(user.subscriptionExpiry);
    const monthsLeft = Math.ceil((expiry.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000));
    const MONTHLY_PRICE = 59.90;
    const fine = (MONTHLY_PRICE * monthsLeft) * 0.10;

    user.status = 'blocked';
    user.subscriptionExpiry = now;
    await user.save();

    return {
      message: 'Assinatura cancelada com sucesso.',
      cancellationFine: fine.toFixed(2),
      details: `Multa de 10% aplicada sobre ${monthsLeft} meses restantes.`
    };
  }

  async getGlobalStats() {
    const totalUsers = await this.userModel.countDocuments();
    const activeSubs = await this.userModel.countDocuments({ status: 'active' });
    const expenses = await this.expenseModel.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    return {
      totalUsers,
      activeSubs,
      globalVolume: expenses[0]?.total || 0,
      conversionRate: totalUsers > 0 ? (activeSubs / totalUsers) * 100 : 0
    };
  }

  async getSettings(key: string) {
    let setting = await this.settingModel.findOne({ key }).exec();
    if (!setting) {
      if (key === 'payment_methods') {
        setting = new this.settingModel({ key, value: { pix: true, card: false, boleto: false } });
        await setting.save();
      }
    }
    return setting;
  }

  async updateSetting(key: string, value: any) {
    return this.settingModel.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }).exec();
  }

  async getSubscriptionProjection() {
    const allUsers = await this.userModel.find().exec();
    const MONTHLY_PRICE = 59.90;

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();

    const projection = months.map((name, index) => {
      // Ativos: status 'active' e validade >= este mês
      const activeInMonth = allUsers.filter(u => {
        if (u.status !== 'active') return false;
        const exp = new Date(u.subscriptionExpiry);
        return exp.getFullYear() > currentYear || (exp.getFullYear() === currentYear && exp.getMonth() >= index);
      }).length;

      // Cancelados: status 'blocked' e a expiração ocorreu/foi antecipada para o passado
      const cancelledInMonth = allUsers.filter(u => {
        if (u.status !== 'blocked') return false;
        const exp = new Date(u.subscriptionExpiry);
        // Simplificação: consideramos cancelado quem bloqueou e a data de expiração/bloqueio cai neste mês
        return exp.getFullYear() === currentYear && exp.getMonth() === index;
      }).length;

      const netSubscribers = Math.max(0, activeInMonth - cancelledInMonth);

      return {
        month: name,
        activeSubscribers: activeInMonth,
        cancelledCount: cancelledInMonth,
        revenue: activeInMonth * MONTHLY_PRICE, // Faturamento vem de quem pagou e está ativo
        netSubscribers 
      };
    });

    let cumulativeRevenue = 0;
    return projection.map((p) => {
      cumulativeRevenue += p.revenue;
      return { ...p, cumulativeRevenue };
    });
  }

  async deleteUser(phone: string) {
    // LGPD: Permanent deletion of all user data
    await this.expenseModel.deleteMany({ userPhone: phone }).exec();
    try {
      const db = this.userModel.db;
      await db.model('Income').deleteMany({ userPhone: phone }).exec();
    } catch (err) {}
    return this.userModel.deleteOne({ phone }).exec();
  }

  async updateUser(phone: string, updateData: any) {
    // Evita alterar o telefone se já existir outro igual
    if (updateData.phone && updateData.phone !== phone) {
      const existing = await this.userModel.findOne({ phone: updateData.phone }).exec();
      if (existing) throw new Error('Este número de telefone já está cadastrado em outro usuário.');
    }
    return this.userModel.findOneAndUpdate({ phone }, updateData, { new: true }).exec();
  }

  async resetPassword(phone: string) {
    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) throw new Error('Usuário não encontrado');

    const tempToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.recoveryToken = tempToken;
    user.recoveryExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min validity
    await user.save();

    return { 
      message: 'Token de recuperação gerado com sucesso.', 
      token: tempToken,
      instructions: 'Envie este token para o cliente via WhatsApp ou e-mail.'
    };
  }

  async resetAllSubscriptions() {
    // Transforma todos os usuários em status 'trial' ou 'free' para limpar a projeção
    const trialExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.userModel.updateMany(
      {}, 
      { status: 'trial', plan: 'free', subscriptionExpiry: trialExpiry }
    ).exec();
  }

  async getDailyNotifications() {
    const allUsers = await this.userModel.find().exec();
    const now = new Date();
    const notifications = [];

    for (const user of allUsers) {
      // 1. Cobrança de Vencimento
      if (user.status === 'active' || user.status === 'blocked') {
        const expiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : new Date(0);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        
        if (diffDays <= 3 && diffDays > 0) {
            notifications.push({
                phone: user.phone,
                type: 'billing_reminder',
                message: `⚠️ Olá ${user.name || ''}, sua assinatura Apolo vence em ${diffDays} dias. Evite bloqueio gerando seu Pix agora!`
            });
        } else if (diffDays <= 0 && diffDays >= -3 && user.status !== 'blocked') {
            notifications.push({
                phone: user.phone,
                type: 'billing_overdue',
                message: `⏳ Atenção ${user.name || ''}! Sua assinatura VENCEU. Você está no período de carência. Pague hoje para manter o acesso.`
            });
        }
      }

      // 2. Aniversário
      if (user.birthday) {
        const bday = new Date(user.birthday);
        if (bday.getDate() === now.getDate() && bday.getMonth() === now.getMonth()) {
            notifications.push({
                phone: user.phone,
                type: 'birthday',
                message: `🎂 Parabéns, ${user.name || ''}! A equipe Apolo deseja um dia incrível e muita saúde financeira para você! 🎉`
            });
        }
      }
    }
    return notifications;
  }
}
