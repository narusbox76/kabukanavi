import { useState } from "react";

export default function Home() {
  const [symbol, setSymbol] = useState("7203.T");
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    const res = await fetch(`/api/stock?symbol=${symbol}`);
    const json = await res.json();
    setData(json);
    setAnalysis("");
    setLoading(false);
  }

  async function analyze() {
    const res = await fetch(`/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setAnalysis(json.text);
  }

  return (
    <div style={{ padding: 30, fontFamily: "sans-serif" }}>
      <h1>株価ナビ（試作）</h1>

      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="例: 7203.T"
      />
      <button onClick={fetchData}>取得</button>

      {loading && <p>取得中...</p>}

      {data && (
        <div>
          <p>現在値: {data.price}</p>
          <p>高値: {data.high}</p>
          <p>安値: {data.low}</p>
          <p>出来高: {data.volume}</p>

          <button onClick={analyze}>AI分析</button>
        </div>
      )}

      {analysis && (
        <div>
          <h3>AI分析</h3>
          <p>{analysis}</p>
        </div>
      )}
    </div>
  );
}
