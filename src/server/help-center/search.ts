import { ARTICLES, type HelpArticle } from "./articles";

export interface SearchEmployee {
  deviceOs?: string | null;
}

export interface ArticleHit {
  id: string;
  title: string;
  body: string;
  category: HelpArticle["category"];
  conditions: HelpArticle["conditions"] | null;
  /** false quando as condições do artigo não valem para o dispositivo do funcionário (FR-013). */
  appliesToEmployee: boolean;
  score: number;
}

const STOPWORDS = new Set(
  "a o as os um uma uns umas de da do das dos em na no nas nos e ou que qual quais como para pra por com sem se meu minha meus minhas seu sua ao aos ate até eu voce você ele ela isso esse essa este esta tem ter ser esta está estou sobre mais muito pouco ja já nao não sim me mim lhe é foi vai quero preciso algum alguma"
    .split(" ")
    .map((w) => normalize(w)),
);

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Igualdade com tolerância a flexão: "conecta" ~ "conectar", "horas" ~ "horario". */
function similar(a: string, b: string): boolean {
  if (a === b) return true;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false;
  let common = 0;
  while (common < a.length && common < b.length && a[common] === b[common]) common += 1;
  const shorter = Math.min(a.length, b.length);
  return common >= 4 && common / shorter >= 0.75;
}

const MIN_SCORE = 2;

function scoreArticle(article: HelpArticle, query: string, queryTokens: string[]): number {
  const title = tokens(article.title);
  const body = tokens(article.body);
  const keywordTokens = article.keywords.flatMap(tokens);
  let score = 0;
  for (const token of queryTokens) {
    if (title.some((t) => similar(t, token))) score += 3;
    if (keywordTokens.some((t) => similar(t, token))) score += 2;
    if (body.some((t) => similar(t, token))) score += 1;
  }
  // Expressões inteiras ("erro 809", "que horas") pesam como palavra-chave.
  for (const keyword of article.keywords) {
    const phrase = normalize(keyword);
    if (phrase.includes(" ") && query.includes(phrase)) score += 2;
  }
  return score;
}

export function articleApplies(article: Pick<HelpArticle, "conditions">, employee: SearchEmployee): boolean {
  const os = article.conditions?.os;
  if (!os || os.length === 0) return true;
  if (!employee.deviceOs) return true;
  return os.some((value) => normalize(value) === normalize(employee.deviceOs ?? ""));
}

/** Busca determinística por termos (título ×3, palavras-chave ×2, corpo ×1), no máximo 3 resultados. */
export function searchHelpCenter(query: string, employee: SearchEmployee = {}, articles = ARTICLES): ArticleHit[] {
  const normalizedQuery = normalize(query);
  const queryTokens = [...new Set(tokens(query))];
  if (queryTokens.length === 0) return [];
  return articles
    .map((article) => ({ article, score: scoreArticle(article, normalizedQuery, queryTokens) }))
    .filter((hit) => hit.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, 3)
    .map(({ article, score }) => ({
      id: article.id,
      title: article.title,
      body: article.body,
      category: article.category,
      conditions: article.conditions ?? null,
      appliesToEmployee: articleApplies(article, employee),
      score,
    }));
}

export function getArticle(id: string): HelpArticle | undefined {
  return ARTICLES.find((a) => a.id === id);
}
