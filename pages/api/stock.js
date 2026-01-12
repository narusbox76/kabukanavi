export default async function handler(req, res) {
  try {
    const symbol = (req.query.symbol || "7203.T").toString();

    // タイムアウト（無限待ち防止）
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      symbol
    )}`;

    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 無いと弾かれる/別形式が返ることがある
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
    }).finally(() => clearTimeout(timeout));

    // YahooがOKを返していない場合は「原因付き」で返す（落ちない）
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(502).json({
        error: "upstream_error",
        message: `Yahoo responded with ${r.status}`,
        detail: text.slice(0, 200),
      });
    }

    // JSONとして読めないケース（HTMLなど）もここで捕まえる
    let json;
    try {
      json = await r.json();
    } catch (e) {
      const text = await r.text().catch(() => "");
      return res.status(502).json({
        error: "invalid_json",
        message: "Yahoo response was not JSON",
        detail: text.slice(0, 200),
      });
    }

    const q = json?.quoteResponse?.result?.[0];
    if (!q) {
      return res.status(404).json({
        error: "no_data",
        message:
          "No quote data returned. Symbol may be invalid or Yahoo may be blocking the request.",
        raw: json?.quoteResponse ?? null,
      });
    }

    return res.status(200).json({
      symbol,
      price: q.regularMarketPrice ?? null,
      high: q.regularMarketDayHigh ?? null,
      low: q.regularMarketDayLow ?? null,
      volume: q.regularMarketVolume ?? null,
      time: q.regularMarketTime ?? null,
    });
  } catch (e) {
    const msg =
      e?.name === "AbortError" ? "timeout" : e?.message || "unknown_error";
    return res.status(500).json({ error: "server_error", message: msg });
  }
}
