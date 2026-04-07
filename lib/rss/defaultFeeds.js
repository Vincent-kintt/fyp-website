export const VALID_CATEGORIES = [
  "technology",
  "science",
  "design",
  "world_news",
  "development",
  "ai_ml",
  "academic",
];

export const DEFAULT_FEEDS = [
  // technology
  { url: "https://hnrss.org/frontpage?points=100", title: "Hacker News", category: "technology" },
  { url: "https://techcrunch.com/feed/", title: "TechCrunch", category: "technology" },
  { url: "https://www.theverge.com/rss/index.xml", title: "The Verge", category: "technology" },
  { url: "http://feeds.arstechnica.com/arstechnica/index/", title: "Ars Technica", category: "technology" },
  { url: "https://www.wired.com/feed/rss", title: "Wired", category: "technology" },
  // science
  { url: "https://www.nature.com/news/feed.rss", title: "Nature News", category: "science" },
  { url: "https://www.sciencedaily.com/rss/all.xml", title: "Science Daily", category: "science" },
  { url: "https://www.nasa.gov/news-release/feed/", title: "NASA", category: "science" },
  // design
  { url: "https://www.smashingmagazine.com/feed", title: "Smashing Magazine", category: "design" },
  { url: "https://css-tricks.com/feed", title: "CSS-Tricks", category: "design" },
  // world_news
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", title: "BBC News", category: "world_news" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", title: "Al Jazeera", category: "world_news" },
  { url: "https://feeds.npr.org/1004/rss.xml", title: "NPR News", category: "world_news" },
  { url: "https://rsshub.app/apnews/topics/apf-topnews", title: "AP News", category: "world_news" },
  // development
  { url: "https://dev.to/feed", title: "DEV Community", category: "development" },
  { url: "https://github.blog/engineering/feed", title: "GitHub Blog", category: "development" },
  // ai_ml
  { url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", title: "MIT Technology Review AI", category: "ai_ml" },
  { url: "https://rss.arxiv.org/rss/cs.AI", title: "arXiv AI", category: "ai_ml" },
  { url: "https://rss.arxiv.org/rss/cs.LG", title: "arXiv ML", category: "ai_ml" },
  // academic
  { url: "https://rss.arxiv.org/rss/cs", title: "arXiv CS", category: "academic" },
  { url: "https://feeds.nature.com/nature/rss/current", title: "Nature", category: "academic" },
];
