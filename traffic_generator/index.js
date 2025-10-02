import { pool } from './db.js';
import axios from 'axios';
import 'dotenv/config';

const CACHE_SERVICE_URL = process.env.CACHE_SERVICE_URL || 'http://localhost:8200';
const REQUESTS_PER_MINUTE =300;
const INTERVAL_MS = 60000 / REQUESTS_PER_MINUTE;

// ------------------- Distribuciones -------------------

// Gaussiana (Normal)
function gaussianRandom(mean = 0, stdDev = 1) {
  let u1 = Math.random();
  let u2 = Math.random();
  let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

function gaussianIndex(N, mean, stdDev) {
  let idx;
  do {
    idx = Math.round(gaussianRandom(mean, stdDev));
  } while (idx < 0 || idx >= N);
  return idx;
}

// Poisson
function poissonRandom(lambda) {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// ------------------- Funciones de tráfico -------------------

async function getQuestionsFromDB() {
  const res = await pool.query('SELECT question_title AS question, best_answer AS answer FROM yahoo_data');
  return res.rows;
}

// Enviar una request al Cache Service
async function sendRequest(question, answer) {
  try {
    const response = await axios.post(`${CACHE_SERVICE_URL}/cache`, { question, answer });
    console.log(`Pregunta: ${question}`);
    console.log(`Respuesta LLM: ${response.data.answer_llm || 'N/A'}, FromCache: ${response.data.fromCache}`);
  } catch (err) {
    console.error(`Error enviando pregunta "${question}":`, err.message);
  }
}

// Generar requests según distribución
async function sendDistributedRequests(questions, distribution = 'uniform') {
  const N = questions.length;
  if (N === 0) return;

  switch (distribution) {
    case 'gaussian':
      {
        const idx = gaussianIndex(N, Math.floor(N / 2), Math.floor(N / 4));
        const { question, answer } = questions[idx];
        await sendRequest(question, answer);
      }
      break;

    case 'poisson':
      {
        const lambda = 2; // promedio de requests por tick, puedes ajustar
        const numRequests = Math.min(poissonRandom(lambda), N);
        for (let i = 0; i < numRequests; i++) {
          const idx = Math.floor(Math.random() * N);
          const { question, answer } = questions[idx];
          await sendRequest(question, answer);
        }
      }
      break;

    case 'uniform':
    default:
      {
        const idx = Math.floor(Math.random() * N);
        const { question, answer } = questions[idx];
        await sendRequest(question, answer);
      }
      break;
  }
}

// ------------------- Simulación principal -------------------

async function runTraffic(distribution = 'uniform') {
  try {
    const client = await pool.connect();
    console.log('Conexión a la BDD exitosa.');
    client.release();
  } catch (err) {
    console.error('Error conectando a la BDD:', err.message);
    process.exit(1);
  }

  const questions = await getQuestionsFromDB();
  console.log(`Se cargaron ${questions.length} preguntas desde la BDD.`);

  while (true) {
    await sendDistributedRequests(questions, distribution);
    await new Promise(r => setTimeout(r, INTERVAL_MS));
  }
}

// ------------------- Arrancar simulación -------------------

// Ejemplo: 'gaussian', 'poisson', 'uniform'
runTraffic('poisson').catch(err => {
  console.error('Error en Traffic Service:', err);
  process.exit(1);
});
