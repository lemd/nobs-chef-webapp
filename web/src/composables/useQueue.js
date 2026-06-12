import { reactive } from 'vue';
import { scrapeRecipe } from '../api.js';
import { state as appState } from '../state.js';

// Module-level singleton queue state
export const queue = reactive({ items: [], running: false });

export function useQueue() {
    function addToQueue(item) {
        // item: { url } or { text }
        queue.items.push({
            ...item,
            label: item.url ?? 'Pasted text',
            qstate: 'pending',
            error: null,
            result: null,
        });
        if (!queue.running) _process();
    }

    async function _process() {
        queue.running = true;
        appState.loading = true;
        while (queue.items.some((i) => i.qstate === 'pending')) {
            const item = queue.items.find((i) => i.qstate === 'pending');
            if (!item) break;
            item.qstate = 'processing';
            try {
                const data = await scrapeRecipe(
                    item.url ? { url: item.url } : { text: item.text },
                );
                const hash = data._hash;
                delete data._cached;
                delete data._hash;
                item.qstate = 'done';
                item.result = { data, hash };
                // Emit event so App.vue / NewView can react
                window.dispatchEvent(
                    new CustomEvent('recipe-scraped', {
                        detail: { data, hash },
                    }),
                );
            } catch (err) {
                item.qstate = 'error';
                item.error = err.message;
            }
        }
        queue.running = false;
        appState.loading = false;
    }

    return { queue, addToQueue };
}
