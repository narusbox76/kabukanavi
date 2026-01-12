// scripts/generate_post.mjs
import fs from "fs";
import path from "path";
import Parser from "rss-parser";

const parser = new Parser();

// ✅ RSSはここをあなた好みに差し替え可（まずは動く枠組み優先）
const FEEDS = [
  { name: "NHK 経済", url: "https://www3.nhk.or.jp/rss/news/cat6.xml" },
  // 例：追加したいRSSがあればここに増やす
  // { name: "Reuters JP", url: "（RSS URL）" },
];

function jstDateKey() {
  // 今日(JST)のYYYY-MM-DD
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

  // タイトル空を除外、最大limit件
  return all.filter(x => x.title).slice(0, limit);
}

function buildDummyPost(items) {
  // ✅ “断定売買禁止”のダミー記事（枠組み）
  const today = jstDateKey();
  const time = jstDateTime();

  const bullets = items.map((x, i) => {
    const url = x.link ? `（${x.link}）` : "";
    return `${i + 1}. [${x.source}] ${x.title} ${url}`;
  }).join("\n");

  const body = `※これは自動更新の「ダミー記事」です（課金/AI生成を後で差し替え予定）。
※投資助言ではありません。売買の断定はしていません。

## 今日の注目ニュース（見出し）
${bullets || "（取得できたニュースがありませんでした：RSSがブロック/停止の可能性）"}

## 今日の市場への影響（テンプレ分析）
- **金利・為替**：利上げ/利下げ観測、円高/円安の方向で輸出入株に影響しやすい  
- **コモディティ**：原油/資源高は素材・エネルギー、コスト増は輸送/小売に影響しやすい  
- **地政学/規制**：防衛、半導体、海運、資源に波及しやすい  
- **個別企業**：決算、上方/下方修正、M&A、リコール等は短期ボラが出やすい

## ウォッチリスト（断定しない）
- **上がりやすい可能性**：ニュースが“追い風”になり得るセクター（輸出/半導体/資源/防衛など）  
- **下がりやすい可能性**：ニュースが“逆風”になり得るセクター（原材料高で利益圧迫、規制強化など）  
- **注目イベント**：決算発表、日銀/FRB、CPI、雇用統計、為替急変

## 次にやること（あなた用）
- RSSを増やす（経済/企業/為替/金利）
- 表示を整える（記事一覧・詳細ページ）
- ここをOpenAI生成に差し替え（課金後）
`;

  return {
    id: `${Date.now()}`,     // 必ずユニーク
    date: today,             // “1日1本”判定用
    generatedAt: time,       // 表示用
    title: `今日の株式市場メモ（ダミー） ${today}`,
    body,
    sources: items,
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
  const already = posts.find(p => p?.date === today);
  if (already) {
    console.log("Post already exists for today. Skip.");
    process.exit(0);
  }

  const items = await fetchTopItems(10);
  const newPost = buildDummyPost(items);

  posts.unshift(newPost);
  savePosts(filePath, posts);

  console.log("✅ appended post:", newPost.id, newPost.date, newPost.generatedAt);
}

main().catch((e) => {
  console.error("❌ generate_post failed:", e);
  process.exit(1);
});
