import { Controller, Get, Post, Body, Query, Res, Patch, Delete, Param } from '@nestjs/common';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
import { FinancialService } from './financial.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('financial')
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('user-status')
  async getStatus(@Query('phone') phone: string) {
    return this.financialService.getUserStatus(phone);
  }

  @Post('expenses')
  @ApiOperation({ summary: 'Registrar nova despesa' })
  async create(@Body() data: CreateExpenseDto) {
    return this.financialService.createExpense(data);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Listar todas as despesas de um usuário' })
  async findAll(@Query('phone') phone: string) {
    return this.financialService.findAllExpenses(phone);
  }

  @Post('income')
  @ApiOperation({ summary: 'Registrar nova receita' })
  async createIncome(@Body() data: CreateIncomeDto) {
    return this.financialService.createIncome(data);
  }

  @Get('income')
  @ApiOperation({ summary: 'Listar todas as receitas de um usuário' })
  async findAllIncome(@Query('phone') phone: string) {
    return this.financialService.findAllIncome(phone);
  }

  @Get('summary')
  async getSummary(@Query('phone') phone: string) {
    return this.financialService.getSummary(phone);
  }

  @Get('projection')
  @ApiOperation({ summary: 'Obter projeção financeira anual (Jan-Dez)' })
  async getProjection(@Query('phone') phone: string) {
    return this.financialService.getProjection(phone);
  }

  @Post('subscription/activate')
  async activate(@Body() data: { phone: string, days: number, key: string }) {
    return this.financialService.updateSubscription(data.phone, data.days, data.key);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Processar Webhook de pagamentos' })
  async handleWebhook(@Body() payload: any) {
    // Placeholder for Mercado Pago/Stripe logic
    console.log('Payment Webhook Received:', payload);
    if (payload.action === 'payment.created') {
        const phone = payload.data.external_reference; 
        // Logic to activate user
    }
    return { status: 'received' };
  }

  @Post('qr')
  @ApiOperation({ summary: 'Atualizar o QR Code do WhatsApp (uso interno do agente)' })
  async updateQr(@Body() data: { qr: string }) {
    this.financialService.setQrCode(data.qr);
    return { status: 'updated' };
  }

  @Get('qr')
  @ApiOperation({ summary: 'Visualizar o QR Code atual para conexão do WhatsApp' })
  async getQr(@Res() res: Response) {
    if (this.financialService.getConnected()) {
       // Se já está conectado, gera um QR com a informação de sucesso
       res.setHeader('Content-Type', 'image/png');
       return QRCode.toFileStream(res, 'WhatsApp Autenticado e Pronto!');
    }
    const qr = this.financialService.getQrCode() || 'Aguardando inicialização do Agente Apollo...';
    res.setHeader('Content-Type', 'image/png');
    await QRCode.toFileStream(res, qr);
  }

  @Post('connected')
  async setConnected(@Body() data: { connected: boolean }) {
    this.financialService.setConnected(data.connected);
    return { status: 'success' };
  }

  @Get('wa-status')
  async getWaStatus() {
    return { connected: this.financialService.getConnected() };
  }

  @Patch('expenses/:id')
  @ApiOperation({ summary: 'Atualizar uma despesa (opção de todas as parcelas)' })
  async updateExpense(
    @Param('id') id: string,
    @Body() data: any,
    @Query('allInstallments') allInstallments: string
  ) {
    return this.financialService.updateExpense(id, data, allInstallments === 'true');
  }

  @Delete('expenses/:id')
  @ApiOperation({ summary: 'Excluir uma despesa (opção de todas as parcelas)' })
  async deleteExpense(
    @Param('id') id: string,
    @Query('allInstallments') allInstallments: string
  ) {
    return this.financialService.deleteExpense(id, allInstallments === 'true');
  }

  @Patch('income/:id')
  @ApiOperation({ summary: 'Atualizar uma receita' })
  async updateIncome(
    @Param('id') id: string,
    @Body() data: any,
    @Query('allInstallments') allInstallments: string
  ) {
    return this.financialService.updateIncome(id, data, allInstallments === 'true');
  }

  @Delete('income/:id')
  @ApiOperation({ summary: 'Excluir uma receita' })
  async deleteIncome(
    @Param('id') id: string,
    @Query('allInstallments') allInstallments: string
  ) {
    return this.financialService.deleteIncome(id, allInstallments === 'true');
  }
}
