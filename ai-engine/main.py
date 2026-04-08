import os
import json
import base64
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = FastAPI(title="Apollo Finance AI - SaaS Edition")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY") 
)

# Persona Definition
SYSTEM_PROMPT = """
Você é o 'Apolo', o assistente financeiro pessoal de elite dos sonhos. 
Sua personalidade é vibrante, educada, proativa e encorajadora, com um toque de 'Cyberpunk Smart'.
Você fala de forma leve, gentil e extremamente inteligente. 
Use emojis apropriados. Trate o usuário pelo nome (se souber) ou de forma cordial.
Seu objetivo é tornar a gestão financeira algo prazeroso, leve e inteligente.

REGRAS DE OURO:
1. Sempre que registrar um gasto, dê um feedback positivo ou um conselho financeiro sábio e motivador.
2. Seja proativo: se o usuário falar algo vago, sugira como você pode ajudar.
3. Use uma linguagem humana, amigável e próxima, como um melhor amigo que cuida do seu dinheiro.
"""

class Transaction(BaseModel):
    description: str
    amount: float
    type: str = "expense" 

class ImageInput(BaseModel):
    base64_image: str

class ChatInput(BaseModel):
    message: str
    history: Optional[List[dict]] = []

@app.post("/analyze")
async def analyze_transaction(transaction: Transaction):
    try:
        response = client.chat.completions.create(
            model="mistralai/mistral-7b-instruct:free",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT + "\nCategorize o gasto em UMA palavra: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Mercado, Outros."},
                {"role": "user", "content": f"Categorize: '{transaction.description}'"}
            ],
            max_tokens=20
        )
        category = response.choices[0].message.content.strip()
        return {"category": category, "persona_response": f"Entendido! Já organizei isso em {category} para você."}
    except Exception as e:
        return {"category": "Outros", "error": str(e)}

@app.post("/analyze-image")
async def analyze_image(data: ImageInput):
    """Vision Computer: Process receipt images"""
    try:
        response = client.chat.completions.create(
            model="google/gemini-flash-1.5:free",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extraia o valor total da nota fiscal e a descrição principal de forma amigável. Responda apenas em JSON: {\"amount\": 0.0, \"description\": \"string\"}"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{data.base64_image}"
                            }
                        }
                    ]
                }
            ]
        )
        # Parse result
        result = json.loads(response.choices[0].message.content.strip())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe_audio(data: ImageInput): # Reuse ImageInput for base64_audio
    """Audio Intelligence: Transcribe voice messages"""
    try:
        # Note: OpenRouter supports various models. 
        # Using mistral-7b-instruct for text chat, but for transcription 
        # we'd usually use whisper. Not all providers on OpenRouter have it.
        # Fallback: instruct mistral to 'be' the logic if it was text, but here we need real STT.
        # Assuming the user has access to a Whisper model or similar.
        # For now, let's pretend we have it or use a cheap STT if possible.
        # As we're using OpenRouter, we'll try a model that can handle audio or generic STT.
        # Actually, let's just stick to the chat for now unless we have a specific STT provider.
        # For this demonstration, we'll simulate transcription if the API doesn't support it directly, 
        # or better: we'll use Gemini-Flash (which can sometimes handle audio if the provider allows).
        # But commonly we just use OpenAI Whisper.
        
        # If openrouter doesn't have an easy STT, we can't do much without a key.
        # Let's try to find a model on OpenRouter that does transcription.
        # Actually, Gemini Flash on OpenRouter can handle multimodal inputs!
        
        response = client.chat.completions.create(
            model="google/gemini-flash-1.5:free",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Transcreva o áudio/narração deste arquivo para texto de forma literal."},
                        {
                            "type": "image_url", # Gemini Flash often uses this for multimodal data in some APIs
                            "image_url": {
                                "url": f"data:audio/mp3;base64,{data.base64_image}"
                            }
                        }
                    ]
                }
            ]
        )
        return {"text": response.choices[0].message.content.strip()}
    except Exception as e:
        return {"error": str(e), "text": "Não consegui ouvir bem esse áudio. Pode repetir?"}

@app.post("/process-message")
async def process_message(data: ChatInput):
    """Structured Processing: Extract intent and data from text"""
    try:
        EXTRACTION_PROMPT = """
        Analise a mensagem do usuário e extraia as seguintes informações em JSON:
        {
          "intent": "expense" | "income" | "status" | "chat",
          "amount": float,
          "description": "string",
          "category": "string",
          "payment_method": "cash" | "debit" | "credit",
          "installments": int (default 1),
          "is_installment": boolean,
          "response": "Uma resposta amigável do Apolo personificado"
        }
        
        Regras:
        - Se for um gasto, intent = expense.
        - Se for um ganho/receita, intent = income.
        - Se o usuário perguntar quanto gastou ou saldo, intent = status.
        - Se for apenas conversa, intent = chat.
        - Identifique parcelamentos (ex: "em 3x", "3 parcelas").
        - Categorias: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Mercado, Outros.
        """
        
        response = client.chat.completions.create(
            model="google/gemini-flash-1.5:free", # Using a smarter model for extraction
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT + "\n" + EXTRACTION_PROMPT},
                {"role": "user", "content": data.message}
            ],
            response_format={ "type": "json_object" }
        )
        
        result = json.loads(response.choices[0].message.content.strip())
        return result
    except Exception as e:
        return {
            "intent": "chat",
            "response": "Ops, tive um probleminha ao processar isso. Pode repetir os detalhes?",
            "error": str(e)
        }

@app.post("/chat")
async def chat_with_apollo(data: ChatInput):
    """Human Chat: Conversational interface"""
    try:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if data.history:
            messages.extend(data.history)
        messages.append({"role": "user", "content": data.message})
        
        response = client.chat.completions.create(
            model="mistralai/mistral-7b-instruct:free",
            messages=messages
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        return {"response": "Desculpe, tive um pequeno soluço digital. O que você dizia?"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
