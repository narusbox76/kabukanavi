import fs from "fs";
import path from "path";

export async function getStaticPaths() {
  const filePath = path.join(process.cwd(), "data", "posts.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const posts = JSON.parse(raw);

  return {
    paths: posts.map((p) => ({ params: { slug: p.slug } })),
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const filePath = path.join(process.cwd(), "data", "posts.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const posts = JSON.parse(raw);

  const post = posts.find((p) => p.slug === params.slug) || null;

  if (!post) return { notFound: true };

  return { props: { post }, revalidate: 60 };
}

export default function PostPage({ post }) {
  return (
    <div style={{ padding: 30, fontFamily: "sans-serif", maxWidth: 900 }}>
      <a href="/">← 記事一覧へ</a>
      <h1 style={{ marginTop: 12 }}>{post.title}</h1>
      <div style={{ fontSize: 12, color: "#666" }}>
        {post.date} / {post.category}
      </div>
      <hr style={{ margin: "20px 0" }} />
      <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
        {post.body}
      </pre>
    </div>
  );
}
