import express from 'express';
import cache from './cache.js';
import axios from 'axios'; 
import 'dotenv/config';
import { pool } from './db.js';
const app = express();
app.use(express.json());
const SCORE_SERVICE_URL = process.env.SCORE_SERVICE_URL;


// Actualizar significa un miss para el cache , donde al cache se le entrega la data dada por el llm 
app.post('/update', (req, res) => {
  const { question, answer_llm, quality_score } = req.body;

  if (!question || !answer_llm || quality_score == null) {
    return res.status(400).json({ error: 'Faltan campos en el body' });
  }
  // Guardar nueva entrada en cache
  cache.set(question, { answer_llm, quality_score});

  const current = cache.get(question);

  res.json({
    message: 'Cache actualizado',
    question,
    answer_llm: current.answer_llm,
    quality_score: current.quality_score,
    timesQueried: current.timesQueried
  });
});
// Endpoint opcional para obtener un item de cache
app.get('/get', (req, res) => {
  const { question } = req.query;
  const item = cache.get(question);
  if (!item) return res.status(404).json({ error: 'No encontrado en cache' });
  res.json(item);
});

// GET /cache?question=...&answer=...
app.post('/cache', async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Faltan los parámetros question o answer' });
  }

  try {
    // 1️⃣ Revisar cache
    const cached = cache.get(question);
    if (cached) {

        await pool.query(
        `UPDATE score_results SET times_querried = times_querried + 1 WHERE question = $1`,
        [question]
      );

      return res.json({
        question,
        answer_llm: cached.answer_llm,
        quality_score: cached.quality_score,
        timesQueried: cached.timesQueried,
        fromCache: true
      });
    }
    // 2️⃣ No está en cache → reutilizar POST /evaluate del Score Service
    const scoreResponse = await axios.post(`${SCORE_SERVICE_URL}`, { question, answer });

    res.json({
      question,
      answer_llm: scoreResponse.data.answer_llm,
      quality_score: scoreResponse.data.quality_score,
      timesQueried: 1,
      fromCache: false
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error procesando la cache y Score Service' });
  }
});

  app.get('/stats', (req, res) => {
  const stats = cache.getStats();
  const isFull = cache.store.size >= parseInt(process.env.MAX_CACHE_SIZE || 300);

  res.json({
    hits: stats.hits,
    misses: stats.misses,
    currentSize: cache.store.size,
    maxSize: parseInt(process.env.MAX_CACHE_SIZE || 300),
    isFull
  });
});
  
    // Reiniciar stats y devolverlas
  app.get('/reset-stats', (req, res) => {
    cache.resetStats();
    res.json({
      message: 'Estadísticas de hits/misses reiniciadas',
      stats: cache.getStats()
    });
  });

const PORT = 8200;
app.listen(PORT, () => console.log(`Cache service running on port ${PORT}`));
