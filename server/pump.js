// Pump.fun API client for creator fee tracking
// Ported from jpm project

const PUMP_BASE_URL = 'https://swap-api.pump.fun';
const JUP_PRICE_URL = 'https://price.jup.ag/v6/price?ids=SOL';

// In-memory cache for SOL price to prevent $0 flicker
let lastGoodSolPrice = 0;

class HttpError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function fetchJSON(url, opts = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'user-agent': 'madurogg/1.0',
        ...(opts.headers || {})
      }
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new HttpError(`HTTP ${res.status} for ${url}`, res.status, body.slice(0, 500));
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

class PumpAPI {
  constructor(config = {}) {
    this.creator = config.creator || process.env.PUMP_CREATOR || '';
    this.mint = config.mint || process.env.TOKEN_MINT || '';
    this.baseUrl = config.baseUrl || PUMP_BASE_URL;
    this.interval = config.interval || '30m';
    this.limit = config.limit || 336; // ~7 days of 30m buckets
  }

  // Get fee buckets (time series data)
  async getFeeBuckets() {
    const basePath = this.creator
      ? `/v1/creators/${this.creator}`
      : `/v1/coins/${this.mint}`;

    const url = `${this.baseUrl}${basePath}/fees?interval=${this.interval}&limit=${this.limit}`;
    return await fetchJSON(url, { cache: 'no-store' }, 12000);
  }

  // Get total fees (creator mode only)
  async getTotalFees() {
    if (!this.creator) return null;
    const url = `${this.baseUrl}/v1/creators/${this.creator}/fees/total`;
    return await fetchJSON(url, { cache: 'no-store' }, 10000);
  }

  // Get coin metadata (holders, etc)
  async getCoinMeta() {
    if (!this.mint) return null;
    const url = `${this.baseUrl}/v1/coins/${this.mint}`;
    return await fetchJSON(url, { cache: 'no-store' }, 8000);
  }

  // Get SOL price in USD (Jupiter, fallback to CoinGecko)
  async getSolPrice() {
    try {
      const data = await fetchJSON(JUP_PRICE_URL, { cache: 'no-store' }, 8000);
      const price = Number(data?.data?.SOL?.price ?? 0);
      if (price > 0) {
        lastGoodSolPrice = price;
        return price;
      }
    } catch (e) {
      console.error('[Pump] Jupiter price error:', e.message);
    }

    // Fallback to CoinGecko
    try {
      const cg = await fetchJSON(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        {},
        6000
      );
      const price = cg?.solana?.usd ?? 0;
      if (price > 0) {
        lastGoodSolPrice = price;
        return price;
      }
    } catch (e) {
      console.error('[Pump] CoinGecko price error:', e.message);
    }

    // Return cached price to prevent $0 display
    return lastGoodSolPrice;
  }

  // Get comprehensive fee stats (main method)
  async getStats() {
    const meta = {};

    try {
      // Fetch all data in parallel
      const [feesRes, totalRes, priceRes, coinRes] = await Promise.allSettled([
        this.getFeeBuckets(),
        this.getTotalFees(),
        this.getSolPrice(),
        this.getCoinMeta()
      ]);

      // Check fees response
      if (feesRes.status !== 'fulfilled' || !Array.isArray(feesRes.value) || feesRes.value.length === 0) {
        return { error: 'No fee buckets returned', meta };
      }

      const fees = feesRes.value;
      const total = totalRes.status === 'fulfilled' ? totalRes.value : null;
      const solPriceUSD = priceRes.status === 'fulfilled' ? priceRes.value : 0;
      const holders = coinRes.status === 'fulfilled' ? (coinRes.value?.holders ?? 0) : 0;

      // Calculate sparkline (cumulative SOL over time)
      const sparklineSOL = fees.map(b => Number(b.cumulativeCreatorFeeSOL || 0));

      // Total balance - prefer /total endpoint, fallback to last bucket
      let balanceSOL = sparklineSOL.at(-1) ?? 0;
      const totalSOL = Number(total?.creatorFeeSOL ?? NaN);
      if (!Number.isNaN(totalSOL) && totalSOL >= 0) {
        balanceSOL = totalSOL;
      }

      // Calculate 24h fees (last 48 buckets for 30m interval)
      const windowSize = this.interval === '30m' ? Math.min(48, fees.length) : Math.min(48, fees.length);
      const slice = fees.slice(-windowSize);
      const startCum = Number(slice.at(0)?.cumulativeCreatorFeeSOL ?? 0);
      const endCum = Number(slice.at(-1)?.cumulativeCreatorFeeSOL ?? 0);
      const fees24hSOL = Math.max(0, endCum - startCum);
      const trades24h = slice.reduce((acc, b) => acc + (b.numTrades ?? 0), 0);

      return {
        mode: this.creator ? 'creator' : 'mint',
        mint: this.mint || '(creator-mode)',
        creator: this.creator || null,
        solPriceUSD,
        balanceSOL,
        balanceUSD: balanceSOL * solPriceUSD,
        fees24hSOL,
        fees24hUSD: fees24hSOL * solPriceUSD,
        trades24h,
        holders,
        updatedAt: new Date().toISOString(),
        sparklineSOL,
        buckets: fees.length
      };
    } catch (e) {
      console.error('[Pump] Stats error:', e.message);
      return { error: e.message, meta };
    }
  }
}

module.exports = { PumpAPI, HttpError, fetchJSON };
