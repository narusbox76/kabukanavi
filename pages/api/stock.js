export default async function handler(req, res) {
  const symbol = req.query.symbol;

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
  const r = await fetch(url);
  const j = await r.json();

  const q = j.quoteResponse.result[0];

  res.status(200).json({
    price: q.regularMarketPrice,
    high: q.regularMarketDayHigh,
    low: q.regularMarketDayLow,
    volume: q.regularMarketVolume,
  });
}
