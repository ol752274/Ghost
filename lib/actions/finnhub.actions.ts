'use server'
import { getDateRange } from '@/lib/utils';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;

interface FinnhubArticle {
    id: number;
    headline: string;
    summary: string;
    source: string;
    url: string;
    image: string;
    category: string;
    datetime: number;
    related: string;
}

export interface NewsArticle {
    id: string;
    headline: string;
    summary: string;
    source: string;
    url: string;
    image: string;
    datetime: Date;
    symbol?: string;
}

async function fetchJSON<T>(
    url: string,
    revalidateSeconds?: number
): Promise<T> {
    const options: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (revalidateSeconds !== undefined) {
        options.cache = 'force-cache';
        options.next = { revalidate: revalidateSeconds };
    } else {
        options.cache = 'no-store';
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
}

function validateArticle(article: unknown): article is FinnhubArticle {
    if (typeof article !== 'object' || article === null) return false;
    
    const a = article as Record<string, unknown>;
    return (
        typeof a.headline === 'string' &&
        typeof a.summary === 'string' &&
        typeof a.source === 'string' &&
        typeof a.url === 'string' &&
        typeof a.datetime === 'number'
    );
}

function formatArticle(article: FinnhubArticle, symbol?: string): NewsArticle {
    return {
        id: `${article.id}`,
        headline: article.headline,
        summary: article.summary,
        source: article.source,
        url: article.url,
        image: article.image || '',
        datetime: new Date(article.datetime * 1000),
        ...(symbol && { symbol }),
    };
}

export const getNews = async (symbols?: string[]): Promise<NewsArticle[]> => {
    try {
        if (!FINNHUB_API_KEY) {
            throw new Error('FINNHUB_API_KEY is not set');
        }

        const { from, to } = getDateRange(5);
        const articles: NewsArticle[] = [];
        const seenIds = new Set<string>();

        if (symbols && symbols.length > 0) {
            // Clean and uppercase symbols
            const cleanSymbols = symbols
                .map(s => s.trim().toUpperCase())
                .filter(s => s.length > 0);

            if (cleanSymbols.length === 0) {
                return getGeneralNews();
            }

            // Round-robin through symbols, max 6 articles total
            let roundCount = 0;
            const maxRounds = 6;

            while (articles.length < 6 && roundCount < maxRounds) {
                for (const symbol of cleanSymbols) {
                    if (articles.length >= 6) break;

                    try {
                        const url = `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;
                        const data = await fetchJSON<unknown[]>(url, 3600);

                        if (Array.isArray(data)) {
                            for (const item of data) {
                                if (articles.length >= 6) break;

                                if (validateArticle(item)) {
                                    const articleId = `${item.id}`;
                                    if (!seenIds.has(articleId)) {
                                        seenIds.add(articleId);
                                        articles.push(formatArticle(item, symbol));
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error(`Error fetching news for symbol ${symbol}:`, e);
                        continue;
                    }
                }

                roundCount++;
            }

            return articles.sort(
                (a, b) => b.datetime.getTime() - a.datetime.getTime()
            );
        } else {
            return getGeneralNews();
        }
    } catch (e) {
        console.error('Error fetching news:', e);
        throw new Error('Failed to fetch news');
    }
};

async function getGeneralNews(): Promise<NewsArticle[]> {
    try {
        if (!FINNHUB_API_KEY) {
            throw new Error('FINNHUB_API_KEY is not set');
        }

        const { from, to } = getDateRange(5);
        const url = `${FINNHUB_BASE_URL}/news?category=general&minId=0&token=${FINNHUB_API_KEY}`;

        const data = await fetchJSON<unknown[]>(url, 3600);

        if (!Array.isArray(data)) {
            return [];
        }

        const seenKeys = new Set<string>();
        const articles: NewsArticle[] = [];

        for (const item of data) {
            if (articles.length >= 6) break;

            if (validateArticle(item)) {
                // Deduplicate by id, url, and headline
                const key = `${item.id}-${item.url}-${item.headline}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    articles.push(formatArticle(item));
                }
            }
        }

        return articles.sort(
            (a, b) => b.datetime.getTime() - a.datetime.getTime()
        );
    } catch (e) {
        console.error('Error fetching general news:', e);
        return [];
    }
}