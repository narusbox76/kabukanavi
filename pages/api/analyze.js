const OpenAI = require("openai");

export default async function handler(req, res) {
  try {
    // POST以外は拒否（無駄課金・Bot対策の第一歩）
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const d = req.body || {};

    const prompt = `
この株のデータを元に日本の個人投資家向けに簡単に分析してください。

現在値: ${d.price}
高値: ${d.high}
安値: ${d.low}
出来高: ${d.volume}

上昇要因、下落リスク、短期的な見方を説明してください。
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return res.status(200).json({
      text: completion.choices?.[0]?.message?.content ?? "",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI analysis failed" });
  }
}
