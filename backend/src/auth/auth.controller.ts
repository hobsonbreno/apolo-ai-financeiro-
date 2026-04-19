import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Patch,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';

class AuthDto {
  @ApiProperty({ example: '5511999999999' })
  phone: string;

  @ApiProperty({ example: 'admin123', required: false })
  key?: string;
}

@ApiTags('autenticação e pagamentos')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cadastrar novo assinante' })
  async register(@Body() data: AuthDto) {
    return this.authService.register(data.phone);
  }

  @Post('register-full')
  @ApiOperation({ summary: 'Cadastro completo de novo usuário' })
  async registerFull(@Body() data: any) {
    return this.authService.registerFull(data);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login via Email/CPF e Senha' })
  async login(@Body() body: { identifier: string; password: string }) {
    return this.authService.login(body.identifier, body.password);
  }

  @Patch('profile/:id')
  @ApiOperation({ summary: 'Atualizar dados e foto do perfil' })
  async updateProfile(@Param('id') id: string, @Body() data: any) {
    return this.authService.updateProfile(id, data);
  }

  @Post('confirm-payment')
  @ApiOperation({ summary: 'Confirmar pagamento e liberar acesso' })
  async confirmPayment(@Body() data: AuthDto) {
    return this.authService.confirmPayment(data.phone, 1, data.key);
  }

  @Get('token')
  @ApiOperation({ summary: 'Gerar token de acesso (validade 1 min)' })
  async getToken(@Query('phone') phone: string) {
    return this.authService.generateToken(phone);
  }

  @Post('checkout/pix')
  @ApiOperation({ summary: 'Gerar cobrança Pix (Mercado Pago)' })
  async checkoutPix(@Body() data: AuthDto) {
    return this.authService.generatePix(data.phone);
  }

  @Post('request-recovery')
  @ApiOperation({ summary: 'Solicitar recuperação de senha (envia token)' })
  async requestRecovery(@Body() body: { identifier: string }) {
    return this.authService.requestRecovery(body.identifier);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Resetar senha com token válido' })
  async resetPassword(@Body() body: { token: string; newPass: string }) {
    return this.authService.resetPassword(body.token, body.newPass);
  }

  @Post('wipe-user')
  @ApiOperation({ summary: 'Limpeza Crítica: Remover usuário para re-cadastro (Testes)' })
  async wipeUser(@Body() body: { identifier: string; masterKey: string }) {
    return this.authService.wipeUser(body.identifier, body.masterKey);
  }
}
