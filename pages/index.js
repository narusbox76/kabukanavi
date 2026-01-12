import { useEffect, useState } from "react";

export default function Home() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/posts");
      const json = await res.json();
      setPosts(json.posts || []);
    })();
  }, []);

  return (
    <div style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 900 }}>
      <h1>株価ナビ</h1>
      <p>AIが毎日自動生成する投資記事（試作）</p>

      <hr style={{ margin: "20px 0" }} />

      {posts.length === 0 ? (
        <p>まだ記事がありません。自動生成が走るとここに増えていきます。</p>
      ) : (
        posts
          .slice()
          .reverse()
          .map((p) => (
            <div
              key={p.slug}
              style={{
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 10,
                marginBottom: 12,
              }}
            >
              <a href={`/posts/${p.slug}`} style={{ fontSize: 18 }}>
                {p.title}
              </a>
              <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                {p.date} / {p.category}
              </div>
              <p style={{ marginTop: 8 }}>{p.excerpt}</p>
            </div>
          ))
      )}
    </div>
  );
}
