import 'dotenv/config';
import OpenAI from 'openai';
import { config } from 'dotenv';
config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Envía un prompt a ChatGPT y devuelve la respuesta de texto.
 * @param {string} prompt - La pregunta o instrucción
 * @returns {Promise<string>} - Respuesta generada por ChatGPT
 */
export async function getLLMResponse(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // o "gpt-4" si tienes acceso
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error("Error al generar respuesta con ChatGPT:", error);
    return "Ocurrió un error al generar la respuesta.";
  }
}