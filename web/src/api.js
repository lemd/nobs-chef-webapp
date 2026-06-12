export const API_BASE = 'https://vcsuynfbykvncenmhjfh.supabase.co/functions/v1';

// Temporary auth — will be replaced with Supabase session token in Phase 5
function getAuthHeader() {
    let secret = localStorage.getItem('nobs_secret');
    if (!secret) {
        secret = prompt('Enter access password:');
        if (!secret) throw new Error('Password required.');
        localStorage.setItem('nobs_secret', secret);
    }
    return `Bearer ${secret}`;
}

export async function fetchRecipes() {
    const res = await fetch(`${API_BASE}/recipes`).catch(() => null);
    if (!res || !res.ok) return [];
    return res.json();
}

export async function fetchRecipe(filename) {
    const res = await fetch(
        `${API_BASE}/recipe?file=${encodeURIComponent(filename)}`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed to load recipe');
    return data;
}

export async function scrapeRecipe({ url, text, force = false }) {
    const res = await fetch(`${API_BASE}/scrape`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: getAuthHeader(),
        },
        body: JSON.stringify(text ? { text } : { url, force }),
    });
    if (res.status === 401) {
        localStorage.removeItem('nobs_secret');
        throw new Error('Wrong password.');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Unknown error');
    return data;
}
