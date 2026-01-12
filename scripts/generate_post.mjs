import fs from "fs";
import path from "path";
import OpenAI from "openai";
import Parser from "rss-parser";

function todayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function fetchRssItems() {
  const parser = new Parser();

  // 例：ここは“あなたの選ぶRSS”に差し替えて運用します
  const feeds = [
    // "https://example.com/rss.xml",
  ];

  const all = [];
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of (feed.items || []).slice(0, 10)) {
        all.push({
          title: item.title || "",
          link: item.link || "",
          pubDate: item.pubDate || "",
          contentSnippet: item.contentSnippet || "",
          source: feed.title || url,
        });
      }
    } catch (e) {
      console.log("RSS fetch failed:", url, e.message);
    }
  }

  // 何も取れない場合でも記事生成は動かす（後で改善）
  return all.slice(0, 12);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const client = new OpenAI({ apiKey });

  const filePath = path.join(process.cwd(), "data", "posts.json");
  const posts = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const date = todayJST();
  if (posts.some((p) => p.date === date)) {
    console.log("Post already exists for today. Skip.");
    return;
  }

  const news = await fetchRssItems();

  const system = `
あなたは日本向けの投資情報メディア編集者です。
必ず守るルール：
- 「買え」「売れ」などの売買推奨はしない（投資助言にならないようにする）
- 断定しない。条件付き・確率・リスク・反証条件（無効化条件）を併記する
- ニュースの本文を転載しない（見出し/要約/リンク提示に留める）
- 出力は必ずJSONのみ（フォーマット厳守）
`;

  const user = `
以下は直近ニュース候補です。これを材料に「今日の注目ポイント」を記事化してください。
ニュースが不足している場合は、一般論（市場の見方・注目指標・リスク管理）で補って構いません。

ニュース一覧（最大12件）：
${news.map((n, i) => `(${i + 1}) [${n.source}] ${n.title}\n- ${n.link}\n- ${n.contentSnippet || ""}`).join("\n\n")}

出力JSONフォーマット：
{
  "category": "市況|材料|決算|テーマ|リスク管理|投資心理",
  "title": "...",
  "excerpt": "...(80〜120文字)",
  "body": "...(800〜1500文字。見出しあり。箇条書きあり。最後に免責を必ず入れる)",
  "watchlist": [
    {
      "ticker_note": "例：銘柄名やコード（不確かなら“要確認”と書く）",
      "catalyst": "上に動きやすい材料（条件付き）",
      "downside_risk": "下振れ要因",
      "what_to_watch": "注目すべき指標/イベント",
      "invalidation": "この条件なら見立てが崩れる"
    }
  ],
  "sources": [
    { "title": "...", "url": "..." }
  ]
}
`;

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system.trim() },
      { role: "user", content: user.trim() },
    ],
    // コスト暴走防止
    max_tokens: 1200,
  });

  const text = resp.choices?.[0]?.message?.content ?? "";
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("Model did not return valid JSON: " + text.slice(0, 200));
  }

  const title = obj.title || "無題";
  const slugBase = slugify(title) || "post";
  const slug = `${date}-${slugBase}`;

  const post = {
    slug,
    date,
    category: obj.category || "市況",
    title,
    excerpt: obj.excerpt || "",
    body: obj.body || "",
    watchlist: obj.watchlist || [],
    sources: obj.sources || [],
  };

  posts.push(post);
  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2), "utf-8");
  console.log("Generated:", slug);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
