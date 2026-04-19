import { Client, LocalAuth, Message, MessageTypes } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const app = express();
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process'
        ]
    }
});

// Endpoint para o Backend enviar mensagens instantâneas
app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message are required' });
    }

    try {
        // Formata o número para o padrão do WhatsApp Web (ex: 5585981251400@c.us)
        const formattedPhone = phone.includes('@c.us') ? phone : `${phone.replace('+', '')}@c.us`;
        await client.sendMessage(formattedPhone, message);
        console.log(`✅ Mensagem enviada via API para ${formattedPhone}`);
        res.json({ success: true });
    } catch (err: any) {
        console.error('❌ Erro ao enviar mensagem via API:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🌐 Servidor de comandos do WhatsApp rodando na porta ${PORT}`);
});

const API_URL = process.env.API_URL || 'http://api:3000/financial';

client.on('qr', async (qr: string) => {
    qrcode.generate(qr, { small: true });
    try {
        await axios.post(`${API_URL}/qr`, { qr });
        console.log('✅ QR Code enviado para a API com sucesso!');
    } catch (err) {
        console.error('❌ Erro ao enviar QR Code para a API:', (err as any).message);
    }
});

client.on('ready', async () => {
    console.log('🚀 Apolo Management Bot is ready!');
    try {
        await axios.post(`${API_URL}/connected`, { connected: true });
    } catch (e) {}
    
    // Inicia Loop de Manutenção e Cobrança (A cada 1 hora para exemplo, pode ser 24h)
    setInterval(async () => {
        console.log('🔄 Executando rotina de manutenção diária...');
        try {
            const ADMIN_API = 'http://api:3000/admin';
            const notificationsRes = await axios.get(`${ADMIN_API}/notifications`);
            const pending = notificationsRes.data;

            for (const note of pending) {
                console.log(`📤 Enviando notificação para ${note.phone} (${note.type})`);
                await client.sendMessage(note.phone, note.message);
                // Pequeno delay para não ser bloqueado pelo WhatsApp
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (err: any) {
            console.error('❌ Erro na rotina de manutenção:', err.message);
        }
    }, 60 * 60 * 1000); 
});

client.on('message', async (msg: Message) => {
    const from = msg.from;
    const myNumber = client.info?.wid?._serialized;
    const text = msg.body.trim().toLowerCase();
    const OWNER_PHONE = process.env.OWNER_PHONE; 

    console.log(`📩 [MESSAGE] De: ${from} | Bot: ${myNumber} | Texto: "${text}"`);

    // 🎧 Filtro de Suporte (Enviar para o ADM)
    if (text.includes('suporte') || text.includes('ajuda') || text.includes('problema')) {
        await msg.reply('🏗️ Entendi que você precisa de ajuda personalizada. Estou encaminhando sua mensagem para meu criador (Humano). Em breve ele te retornará!');
        if (OWNER_PHONE) {
            const contact = await msg.getContact();
            await client.sendMessage(OWNER_PHONE, `🆘 *PEDIDO DE SUPORTE*\nUsuário: ${contact.pushname || from}\nWhatsApp: ${from}\n\nMensagem: ${text}`);
        }
        return;
    }

    // 🔒 BLINDAGEM DE ASSINATURA...
    if (from !== myNumber && from !== OWNER_PHONE) {
        console.log(`🚫 Mensagem ignorada (não é do proprietário). Emissor: ${from}`);
        // Opcional: Responder uma vez que está restrito (para não deixar no vácuo se for o dono testando de outro cel)
        return; 
    }

    console.log(`🚀 [COMANDO ACEITO] - Processando: "${text || '[Mídia]'}"`);
    
    // 1. Validação de Assinatura via API (Vínculo Individual)
    try {
        const userStatus = await axios.get(`${API_URL}/user-status?phone=${from}`);
        if (userStatus.data.status !== 'active' && userStatus.data.status !== 'trial') {
            return msg.reply('⚠️ Sua assinatura do Apolo não está ativa. Por favor, regularize para realizar lançamentos.');
        }
    } catch (e) {
        console.log('Validação de assinatura ignorada em modo bypass.');
    }

    // 2. Handle Media (Images & Audio)
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        const aiUrl = process.env.AI_URL || 'http://ai-engine:8000';

        // IMAGES (Vision)
        if (msg.type === MessageTypes.IMAGE) {
            msg.reply('💡 Vi que você mandou uma foto! Vou extrair as informações da nota para você, só um momento...');
            try {
                const visionResponse = await axios.post(`${aiUrl}/analyze-image`, {
                    base64_image: media.data
                });
                const { amount, description } = visionResponse.data;
                await axios.post(`${API_URL}/expenses`, {
                    description: description || 'Gasto via Foto',
                    amount,
                    phone: from
                });
                return msg.reply(`✅ Recebido! Registrei R$ ${amount} referente a *${description}*. Sua organização financeira agradece!`);
            } catch (err) {
                return msg.reply('❌ Desculpe, não consegui ler essa imagem. Pode tentar escrever o valor?');
            }
        }

        // AUDIO / VOICE (Transcription)
        if (msg.type === MessageTypes.AUDIO || msg.type === MessageTypes.VOICE || (msg.type as any) === 'ptt') {
            msg.reply('🎧 Ouvindo seu áudio...');
            try {
                const transcribeRes = await axios.post(`${aiUrl}/transcribe`, {
                    base64_image: media.data // Reusing the field for audio data
                });
                const transcribedText = transcribeRes.data.text;
                console.log(`🎙️ Áudio transcrito: "${transcribedText}"`);
                
                // Agora processamos o texto transcrito como se fosse uma mensagem de texto normal
                // (Recursão simples ou apenas disparar a lógica abaixo)
                return processTextCommand(msg, transcribedText, from);
            } catch (err) {
                return msg.reply('❌ Puxa, não consegui entender o áudio. Pode escrever para mim?');
            }
        }
    }

    return processTextCommand(msg, text, from);
});

async function processTextCommand(msg: Message, text: string, from: string) {
    const API_URL = process.env.API_URL || 'http://api:3000/financial';
    const AI_URL = process.env.AI_URL || 'http://ai-engine:8000';

    if (!text || text.length === 0) return;

    // 3. Smart Processing with AI
    try {
        const processRes = await axios.post(`${AI_URL}/process-message`, { message: text });
        const { intent, amount, description, category, payment_method, installments, response } = processRes.data;

        if (intent === 'expense' && amount > 0) {
            console.log(`💸 Registrando gasto: R$ ${amount} - ${description} (${installments}x)`);
            await axios.post(`${API_URL}/expenses`, { 
                description, 
                amount, 
                phone: from,
                categoryName: category,
                paymentMethod: payment_method,
                installments: installments
            });
            return msg.reply(response || `✅ Anotado! R$ ${amount} em *${description}* registrado.`);
        } 
        
        if (intent === 'income' && amount > 0) {
            console.log(`💰 Registrando receita: R$ ${amount} - ${description}`);
            await axios.post(`${API_URL}/income`, { 
                description, 
                amount, 
                phone: from,
                categoryName: category
            });
            return msg.reply(response || `✅ Recebido! R$ ${amount} de *${description}* adicionado.`);
        }

        if (intent === 'status') {
            const summaryRes = await axios.get(`${API_URL}/summary?phone=${from}`);
            const { balance, totalExpenses, totalIncome } = summaryRes.data;
            const statusMsg = `📊 *Seu resumo atual:*\n\n💰 Saldo: R$ ${balance.toFixed(2)}\n📉 Gastos: R$ ${totalExpenses.toFixed(2)}\n📈 Entradas: R$ ${totalIncome.toFixed(2)}\n\nO que mais posso fazer por você?`;
            return msg.reply(statusMsg);
        }

        // Default or 'chat' intent
        return msg.reply(response || "Estou aqui para ajudar com suas finanças! Como posso ajudar?");

    } catch (error: any) {
        console.error('Erro no processamento IA:', error.message);
        // Fallback simple chat if processing fails
        try {
            const chatRes = await axios.post(`${AI_URL}/chat`, { message: text });
            msg.reply(chatRes.data.response);
        } catch (chatErr) {
            msg.reply('Puxa, tive um pequeno problema técnico. Pode repetir?');
        }
    }
}

client.initialize();
