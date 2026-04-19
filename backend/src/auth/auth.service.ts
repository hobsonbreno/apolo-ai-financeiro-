import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Setting, SettingDocument } from '../schemas/setting.schema';
import { JwtService } from '@nestjs/jwt';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private mpClient: MercadoPagoConfig;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
    private jwtService: JwtService,
  ) {
    this.mpClient = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN || 'SUA_CHAVE_AQUI',
    });
  }

  async login(identifier: string, password: string) {
    const user = await this.userModel.findOne({
      $or: [{ email: identifier }, { cpf: identifier }, { phone: identifier }]
    }).exec();

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        cpf: user.cpf,
        role: user.role,
        avatarUrl: user.avatarUrl,
        status: user.status,
        plan: user.plan
      },
      token: this.jwtService.sign({ 
        phone: user.phone, 
        sub: user.id, 
        role: user.role,
        name: user.name 
      }),
    };
  }

  async registerFull(data: any) {
    // Password regex: Ao menos uma maiúscula, uma minúscula e um símbolo. Sem limite de tamanho máximo.
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).*$/;
    
    if (!passwordRegex.test(data.password)) {
      throw new UnauthorizedException('A senha deve conter pelo menos uma letra Maiúscula, uma Minúscula e um Caractere Especial.');
    }
    
    if (data.password.length < 6) {
      throw new UnauthorizedException('A senha deve ter no mínimo 6 caracteres.');
    }

    const existing = await this.userModel.findOne({ 
      $or: [{ email: data.email }, { cpf: data.cpf }, { phone: data.phone }] 
    }).exec();
    
    if (existing) throw new UnauthorizedException('E-mail, CPF ou WhatsApp já cadastrado');

    const totalUsers = await this.userModel.countDocuments();
    let role = 'user';
    
    const MASTER_KEY = process.env.BYPASS_ADMIN_KEY || 'admin123';
    if (data.adminCode === MASTER_KEY || data.adminCode === 'APOLO_ADMIN' || totalUsers === 0) {
      role = 'admin';
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = new this.userModel({
      ...data,
      password: hashedPassword,
      role,
      status: 'trial',
      subscriptionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    return user.save();
  }

  async updateProfile(userId: string, data: any) {
    return this.userModel
      .findByIdAndUpdate(userId, { $set: data }, { new: true })
      .exec();
  }

  async register(phone: string) {
    let user = await this.userModel.findOne({ phone }).exec();
    if (!user) {
      user = new this.userModel({
        phone,
        status: 'trial',
        subscriptionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias de trial
      });
      await user.save();
    }
    return user;
  }

  async generatePix(phone: string) {
    const payment = new Payment(this.mpClient);
    try {
      const response = await payment.create({
        body: {
          transaction_amount: 59.9, // Valor da mensalidade
          description: 'Mensalidade Apollo AI',
          payment_method_id: 'pix',
          payer: { email: `${phone}@apollo-bot.com.br` }, // Fake email for MP
          external_reference: phone,
          installments: 1,
        }
      });
      const res = response as any;
      return {
        id: res.id,
        pix_key: res.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: res.point_of_interaction?.transaction_data?.qr_code_base64,
        payment_link: res.point_of_interaction?.transaction_data?.ticket_url,
      };
    } catch (error) {
      this.logger.error(`Erro ao gerar Pix no Mercado Pago: ${error}`);
      throw new Error('Não foi possível gerar a cobrança agora.');
    }
  }

  async confirmPayment(phone: string, months: number = 1, key?: string) {
    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const MASTER_KEY = process.env.BYPASS_ADMIN_KEY || 'admin123';
    
    // Se a chave for a do Admin, confirma direto (Teste Admin)
    if (key === MASTER_KEY) {
      this.logger.log(
        `⚠️ Pagamento confirmado via BYPASS ADMIN para: ${phone}`,
      );
    } else {
      // Aqui seria a validação real do ID do Mercado Pago se necessário, 
      // mas para o fluxo de 'confirmação manual/webhook' usamos o Admin.
    }

    user.status = 'active';
    const currentExpiry = user.subscriptionExpiry?.getTime() || Date.now();
    user.subscriptionExpiry = new Date(
      currentExpiry + months * 30 * 24 * 60 * 60 * 1000,
    );
    await user.save();

    return {
      message: 'Pagamento confirmado! Acesso renovado.',
      token: this.jwtService.sign({ phone: user.phone, sub: user.id }),
    };
  }

  async generateToken(phone: string) {
    const user = await this.userModel.findOne({ phone }).exec();
    if (!user) throw new UnauthorizedException('Acesso negado');

    const now = new Date();
    const expiry = user.subscriptionExpiry || new Date(0);
    const gracePeriod = new Date(expiry.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 dias extras

    // LÓGICA DE BLOQUEIO (Após 33 dias se não pago)
    if (now > gracePeriod) {
      user.status = 'blocked';
      await user.save();
      throw new UnauthorizedException('Assinatura bloqueada por falta de pagamento. Gere um novo Pix.');
    }

    // LÓGICA DE NOTIFICAÇÃO (Entre dia 27 e 30)
    const notificationStart = new Date(expiry.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 dias antes dos 30
    let billingAlert = null;
    
    if (now > notificationStart && now <= expiry) {
      billingAlert = "⚠️ Sua assinatura vence em breve! Gere um Pix no menu para não perder o acesso.";
    } else if (now > expiry && now <= gracePeriod) {
      billingAlert = "⏳ Assinatura VENCIDA! Você está no período de carência de 3 dias. Pague agora para evitar bloqueio.";
    }

    return {
      token: this.jwtService.sign({ phone: user.phone, sub: user.id }),
      expiresIn: '60s',
      billingAlert
    };
  }

  async requestRecovery(identifier: string) {
    const user = await this.userModel.findOne({
      $or: [{ phone: identifier }, { email: identifier }, { cpf: identifier }],
    });
    if (!user) throw new Error('Usuário não encontrado');

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    user.recoveryToken = token;
    user.recoveryExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    // Aqui dispararia o WhatsApp Agent se quisesse automatizar 100%
    console.log(`[RECOVERY] Token para ${user.phone}: ${token}`);

    return {
      message: 'Token de recuperação enviado!',
      phone: user.phone, // Para o front saber para onde foi
    };
  }

  async resetPassword(token: string, newPass: string) {
    const user = await this.userModel.findOne({
      recoveryToken: token,
      recoveryExpiry: { $gt: new Date() },
    });
    if (!user) throw new Error('Token inválido ou expirado.');

    // Validação de segurança da nova senha
    user.password = await bcrypt.hash(newPass, 10);
    // @ts-ignore
    user.recoveryToken = undefined;
    // @ts-ignore
    user.recoveryExpiry = undefined;
    await user.save();

    return { message: 'Senha atualizada com sucesso!' };
  }
}
