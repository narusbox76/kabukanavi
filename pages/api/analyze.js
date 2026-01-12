import OpenAI from "openai";

export default async function handler(req, res) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const d = req.body;

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

  res.status(200).json({
    text: completion.choices[0].message.content,
  });
}
