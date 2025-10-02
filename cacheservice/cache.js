import 'dotenv/config';

const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600; // segundos
const MAX_CACHE_SIZE = 1000;
const CACHE_POLICY = process.env.CACHE_POLICY || 'LRU'; // 'LRU' o 'LFU'

class Cache {
  constructor() {
    this.store = new Map();
    this.stats = { hits: 0, misses: 0 }; // 🟢 estadísticas en memoria
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // TTL
    const now = Date.now();
    if (CACHE_TTL && (now - entry.timestamp) / 1000 > CACHE_TTL) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    if (entry.timesQueried > 0) {
    this.stats.hits++;
    }
    entry.timesQueried++;

    if (CACHE_POLICY === 'LRU') {
      this.store.delete(key);
      this.store.set(key, entry);
    }

    if (CACHE_POLICY === 'LFU') {
      entry.freq = (entry.freq || 0) + 1;
    }

    return entry;
  }

  set(key, value) {
    if (this.store.size >= MAX_CACHE_SIZE) {
      if (CACHE_POLICY === 'LRU') {
        const firstKey = this.store.keys().next().value;
        this.store.delete(firstKey);
      } else if (CACHE_POLICY === 'LFU') {
        let minFreq = Infinity;
        let minKey;
        for (const [k, v] of this.store) {
          if ((v.freq || 0) < minFreq) {
            minFreq = v.freq;
            minKey = k;
          }
        }
        if (minKey) this.store.delete(minKey);
      }
    }

    this.store.set(key, {
      ...value,
      timestamp: Date.now(),
      freq: 1,
      timesQueried: 0
    });
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }
}

export default new Cache();

