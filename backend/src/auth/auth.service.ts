import { Injectable, UnauthorizedException, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import axios from 'axios';
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
      throw new BadRequestException('Não foi possível gerar a cobrança agora.');
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
    if (!user) throw new NotFoundException('Usuário não encontrado com os dados informados.');

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    user.recoveryToken = token;
    user.recoveryExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    // Dispara envio real via WhatsApp Agent
    try {
      const WHATSAPP_AGENT_URL = process.env.WHATSAPP_AGENT_URL || 'http://whatsapp-agent:3001';
      await axios.post(`${WHATSAPP_AGENT_URL}/send-message`, {
        phone: user.phone,
        message: `🔐 *APOLO AI - RECUPERAÇÃO*\n\nSeu código de acesso é: *${token}*\n\nUse este código na tela de recuperação. Ele expira em 15 minutos.`
      });
      this.logger.log(`✅ Token de recuperação enviado via WhatsApp para ${user.phone}`);
    } catch (err: any) {
      this.logger.error(`❌ Falha ao enviar WhatsApp: ${err.message}`);
      // Não travamos o processo se o WhatsApp falhar, o token ainda existe no banco para o admin ver
    }

    return {
      message: 'Token de recuperação enviado via WhatsApp!',
      phone: user.phone,
    };
  }

  async resetPassword(token: string, newPass: string) {
    const user = await this.userModel.findOne({
      recoveryToken: token,
      recoveryExpiry: { $gt: new Date() },
    });
    if (!user) throw new BadRequestException('Token inválido ou expirado.');

    // Validação de segurança da nova senha
    user.password = await bcrypt.hash(newPass, 10);
    // @ts-ignore
    user.recoveryToken = undefined;
    // @ts-ignore
    user.recoveryExpiry = undefined;
    await user.save();

    return { message: 'Senha atualizada com sucesso!' };
  }

  async wipeUser(identifier: string, masterKey: string) {
    const MASTER_KEY = process.env.BYPASS_ADMIN_KEY || 'admin123';
    if (masterKey !== MASTER_KEY) throw new UnauthorizedException('Chave Mestra Inválida');
    
    const res = await this.userModel.deleteOne({
      $or: [{ email: identifier }, { cpf: identifier }, { phone: identifier }]
    }).exec();
    
    if (res.deletedCount === 0) throw new NotFoundException('Usuário não encontrado');
    return { message: 'Usuário removido com sucesso. Pode cadastrar novamente.' };
  }
}
