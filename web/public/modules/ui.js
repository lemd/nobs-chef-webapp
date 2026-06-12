import { els } from './state.js';

export function mosaicLoading(on) {
    document.querySelector('.mosaic-strip')?.classList.toggle('loading', on);
}

export function setStatus(msg, isError = false, loading = false) {
    els.btn.disabled = loading;
    mosaicLoading(loading);
    els.status.className = isError ? 'error' : '';
    els.status.innerHTML = loading
        ? `<span class="spinner"></span>${msg}`
        : isError
          ? `${msg}`
          : msg;
}
