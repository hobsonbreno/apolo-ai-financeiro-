import { Controller, Get, Post, Body, Param, Delete, Patch, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  
  @Post('wipe-data-projection')
  async wipeData() {
    console.log('--- WIPE DATA REQUEST RECEIVED ---');
    return this.adminService.resetAllSubscriptions();
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar todos os usuários' })
  async listUsers(@Query('status') status?: string) {
    if (status) {
      return this.adminService.getUsersByStatus(status);
    }
    return this.adminService.getAllUsers();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obter estatísticas globais da plataforma' })
  async getStats() {
    return this.adminService.getGlobalStats();
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Obter notificações pendentes para o Robô disparar' })
  async getNotifications() {
    return this.adminService.getDailyNotifications();
  }

  @Patch('users/:phone/status')
  @ApiOperation({ summary: 'Atualizar status e plano (bloquear/desbloquear/free)' })
  async updateStatus(@Param('phone') phone: string, @Body() body: { status: string, plan?: string }) {
    return this.adminService.setUserStatus(phone, body.status, body.plan);
  }

  @Patch('users/:phone/expiry')
  @ApiOperation({ summary: 'Atualizar data de expiração da assinatura' })
  async updateExpiry(@Param('phone') phone: string, @Body() body: { expiry: string }) {
    return this.adminService.updateUserExpiry(phone, new Date(body.expiry));
  }

  @Patch('users/:phone')
  @ApiOperation({ summary: 'Editar dados gerais do usuário' })
  async updateUser(@Param('phone') phone: string, @Body() body: any) {
    return this.adminService.updateUser(phone, body);
  }

  @Post('users/:phone/cancel')
  @ApiOperation({ summary: 'Cancelar assinatura com cálculo de multa' })
  async cancelSub(@Param('phone') phone: string) {
    return this.adminService.cancelSubscription(phone);
  }

  @Get('subs-projection')
  @ApiOperation({ summary: 'Projeção mensal de receitas de assinaturas' })
  async getSubProjection() {
    return this.adminService.getSubscriptionProjection();
  }

  @Post('users/:phone/reset')
  async resetTrial(@Param('phone') phone: string) {
    return this.adminService.resetTrial(phone);
  }

  @Post('users/:phone/reset-password')
  @ApiOperation({ summary: 'Gerar token de recuperação de senha por solicitação manual' })
  async adminResetPassword(@Param('phone') phone: string) {
    return this.adminService.resetPassword(phone);
  }

  @Delete('users/:phone')
  async deleteUser(@Param('phone') phone: string) {
    return this.adminService.deleteUser(phone);
  }

  @Get('settings/:key')
  @ApiOperation({ summary: 'Obter configurações globais (ex: formas de pagamento)' })
  async getSettings(@Param('key') key: string) {
    return this.adminService.getSettings(key);
  }

  @Post('settings/:key')
  @ApiOperation({ summary: 'Atualizar configurações (ex: habilita/desabilita Pix)' })
  async updateSetting(@Param('key') key: string, @Body() body: any) {
    return this.adminService.updateSetting(key, body.value);
  }
}
