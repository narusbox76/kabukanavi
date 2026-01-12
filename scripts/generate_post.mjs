// scripts/generate_post.mjs
import fs from "fs";
import path from "path";
import Parser from "rss-parser";
import OpenAI from "openai";

const parser = new Parser();

// ✅ RSSは強化できます（今は枠組み優先）
const FEEDS = [
  { name: "NHK 経済", url: "https://www3.nhk.or.jp/rss/news/cat6.xml" },
];

function jstDateKey() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function jstDateTime() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().replace("T", " ").slice(0, 16);
}

async function fetchTopItems(limit = 10) {
  const all = [];
  for (const f of FEEDS) {
    try {
      const feed = await parser.parseURL(f.url);
      const items = (feed.items || []).slice(0, Math.ceil(limit / FEEDS.length));
      for (const it of items) {
        all.push({
          source: f.name,
          title: it.title || "",
          link: it.link || "",
          pubDate: it.pubDate || "",
        });
      }
    } catch (e) {
      console.log("⚠ RSS failed:", f.name, String(e?.message || e));
    }
  }
  return all.filter((x) => x.title).slice(0, limit);
}

function buildDummyPost(items, meta) {
  const today = jstDateKey();
  const time = jstDateTime();

  const slug = `${today}-daily`; // ✅ Vercelビルド用に必須

  const bullets = items
    .map((x, i) => {
      const url = x.link ? `（${x.link}）` : "";
      return `${i + 1}. [${x.source}] ${x.title} ${url}`;
    })
    .join("\n");

  const body = `※これは自動更新の「ダミー記事」です（OpenAIが使えない場合のフォールバック）。
※投資助言ではありません。売買の断定はしていません。

## 今日の注目ニュース（見出し）
${bullets || "（取得できたニュースがありませんでした：RSSがブロック/停止の可能性）"}

## 今日の市場への影響（テンプレ分析）
- 金利・為替：利上げ/利下げ観測、円高/円安で輸出入株に影響しやすい
- 資源：原油/資源高は素材・エネルギー、コスト増は輸送/小売に影響しやすい
- 地政学/規制：防衛、半導体、海運、資源に波及しやすい
- 個別企業：決算、上方/下方修正、M&A等は短期ボラが出やすい

## ウォッチリスト（断定しない）
- 「追い風/逆風」になり得るセクターを中心に監視
- 決算発表、日銀/FRB、CPI、雇用統計、為替急変を注視

---

### 生成モード
${meta.mode}${meta.note ? `\n### メモ\n${meta.note}\n` : ""}
`;

  return {
    slug,
    id: `${Date.now()}`,
    date: today,
    generatedAt: time,
    title: `今日の株式市場メモ ${today}`,
    body,
    sources: items,
    mode: meta.mode, // "dummy"
  };
}

async function buildAiPost(items) {
  const today = jstDateKey();
  const time = jstDateTime();
  const slug = `${today}-daily`;

  const lines = items
    .map((x, i) => {
      return `${i + 1}. [${x.source}] ${x.title}\nURL: ${x.link || "N/A"}\n`;
    })
    .join("\n");

  const system = `
あなたは日本株（東証）向けの経済ニュース要約ライターです。
- 投資助言ではありません。断定売買は禁止。
- 「上がる/下がる」など断定は禁止し、必ず「可能性」「シナリオ」「条件」を明記。
- 出典は必ずURLを添える（ニュース一覧は既にあるため、本文では重要なものだけで良い）。
- 文章は日本語。簡潔に。
`;

  const prompt = `
以下の「ニュース見出し一覧（URL付き）」を材料に、今日の日本株の見通しをまとめてください。

【ニュース一覧】
${lines}

【出力フォーマット】
# 今日の概況（3行）
# 重要トピック（最大5つ：各トピックに影響しやすいセクター/銘柄の例を添える。ただし断定禁止）
# リスク（最大5つ）
# ウォッチリスト（セクター中心：最大8行）
# 今日の注目イベント（最大5つ）
# 免責（1行）
`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system.trim() },
      { role: "user", content: prompt.trim() },
    ],
  });

  const body = completion.choices?.[0]?.message?.content?.trim();
  if (!body) throw new Error("OpenAI returned empty content");

  return {
    slug,
    id: `${Date.now()}`,
    date: today,
    generatedAt: time,
    title: `今日の日本株ニュース分析 ${today}`,
    body,
    sources: items,
    mode: "ai",
  };
}

function loadPosts(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(raw);
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

function savePosts(filePath, posts) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2), "utf-8");
}

async function main() {
  const filePath = path.join(process.cwd(), "data", "posts.json");
  const posts = loadPosts(filePath);

  const today = jstDateKey();
  const already = posts.find((p) => p?.date === today);
  if (already) {
    console.log("Post already exists for today. Skip.");
    process.exit(0);
  }

  const items = await fetchTopItems(15);

  const useOpenAI = (process.env.USE_OPENAI || "").toLowerCase() === "true";

  let newPost;
  if (useOpenAI) {
    try {
      newPost = await buildAiPost(items);
      console.log("✅ AI post generated");
    } catch (e) {
      console.log("⚠ OpenAI failed, fallback to dummy:", String(e?.message || e));
      newPost = buildDummyPost(items, { mode: "dummy", note: String(e?.message || e) });
    }
  } else {
    newPost = buildDummyPost(items, { mode: "dummy", note: "USE_OPENAI is false" });
  }

  posts.unshift(newPost);
  savePosts(filePath, posts);

  console.log("✅ appended post:", newPost.mode, newPost.id, newPost.date, newPost.generatedAt);
}

main().catch((e) => {
  console.error("❌ generate_post failed:", e);
  process.exit(1);
});
