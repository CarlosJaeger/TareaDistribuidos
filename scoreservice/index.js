import express from 'express';
import { pool } from './db.js';
import { getLLMResponse } from './llm.js';
import { calculateQuality } from './score.js';
import axios from 'axios'; 
import { config } from 'dotenv';

config();

const app = express();
app.use(express.json());

const CACHE_SERVICE_URL = process.env.CACHE_SERVICE_URL;

// Función para verificar conexión a la BDD
async function checkDBConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conectado correctamente a la base de datos');
    console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err);
    process.exit(1);
  }
}

// Endpoint para evaluar calidad
app.post('/evaluate', async (req, res) => {
  const { question, answer } = req.body;

  try {
    // 1️⃣ Obtener respuesta LLM
    const llmAnswer = await getLLMResponse(question, 200);
    console.log('LLM Answer:', llmAnswer);

    // 2️⃣ Calcular calidad
    const qualityScore = await calculateQuality(llmAnswer, answer);
    console.log('Quality Score:', qualityScore);

    // 3️⃣ Guardar en la BDD
    await pool.query(
  'INSERT INTO score_results(question, answer_yahoo, answer_llm, quality_score, times_querried) VALUES($1,$2,$3,$4,1)',
    [question, answer, llmAnswer, qualityScore]
  );


    // 4️⃣ Enviar al Cache Service
    try {
      await axios.post(CACHE_SERVICE_URL, {
        question,
        answer_llm: llmAnswer,
        quality_score: qualityScore
      });
      console.log('Cache actualizado correctamente');
    } catch (cacheErr) {
      console.error('Error al actualizar Cache Service:', cacheErr.message);
    }

    // 5️⃣ Responder al cliente
    res.json({ question, answer_llm: llmAnswer, quality_score: qualityScore });

  } catch (err) {
    console.error('Error en Score Service:', err);
    res.status(500).json({ error: 'Error en Score Service' });
  }
});


// Endpoint para solo llamar al LLM
app.post('/llm', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Falta question en el body' });
  }

  try {
    const answer = await getLLMResponse(question);
    res.json({ question, answer_llm: answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error llamando al LLM' });
  }
});

checkDBConnection().then(() => {
  const PORT = 8100;
  app.listen(PORT, () => console.log(`Score service running on port ${PORT}`));
});
