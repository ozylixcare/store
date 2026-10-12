// Public review pages only. Never cache customer tokens or account data here.
window.OzylixReviewData = (() => {
  const cache = new Map(), pending = new Map(), versions = new Map();
  const ttl = 30000;
  async function load(id, options = {}) {
    const view = rvViewState(id);
    const limit = view.expanded ? 10 : 3;
    const offset = view.expanded ? view.page * 10 : 0;
    const key = `${id}:${limit}:${offset}`;
    const version = (versions.get(id) || 0) + 1;
    versions.set(id,version);
    if (options.force) {
      for (const k of cache.keys()) if (k.startsWith(id + ':')) cache.delete(k);
      for (const k of pending.keys()) if (k.startsWith(id + ':')) pending.delete(k);
    }
    REVIEWS_LOADED[id] = false;
    if (currentProduct?.id === id) renderProductReviewList(id);
    try {
      let payload;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < ttl) payload = hit.payload;
      else {
        if (!pending.has(key)) {
          const request = (async()=>{
            const response = await fetch(`${API_BASE}/api/public-reviews?product_id=${encodeURIComponent(id)}&limit=${limit}&offset=${offset}${options.force ? '&fresh=1' : ''}`, {
              credentials:'omit',headers:{Accept:'application/json'},cache:options.force ? 'no-store' : 'default',signal:AbortSignal.timeout(20000),
            });
            const result = await response.json();
            if (!response.ok || !Array.isArray(result.reviews)) throw new Error('Reviews unavailable');
            return result;
          })();
          pending.set(key,request);
          request.finally(()=>{if(pending.get(key) === request) pending.delete(key);}).catch(()=>{});
        }
        payload = await pending.get(key);
      }
      const rows = payload.reviews.map(r=>({id:r.id,user:r.user_name,rating:Number(r.rating),text:r.review_text,date:r.created_at,updatedAt:r.updated_at,verified:r.verified===true}));
      if (versions.get(id) !== version) return rows;
      if (offset > 0 && offset >= Number(payload.total)) {
        view.page = Math.max(0,Math.ceil(Number(payload.total)/10)-1);
        return load(id,options);
      }
      cache.set(key,{payload,at:Date.now()});
      if (cache.size > 60) cache.delete(cache.keys().next().value);
      REVIEW_META[id] = {total:Number(payload.total)||0,average:payload.average == null ? null : Number(payload.average),histogram:payload.histogram||{}};
      REVIEWS[id] = rows;
      REVIEWS_LOADED[id] = true;
      refreshProductReviewUI(id);
      return REVIEWS[id];
    } catch(error) {
      if (versions.get(id) !== version) return;
      if (currentProduct?.id === id) {
        const wrap = document.getElementById('rvListWrap');
        if (wrap) wrap.innerHTML = '<p role="status">Reviews could not load. <button type="button" onclick="loadProductReviews(' + Number(id) + ')">Retry</button></p>';
      }
      if (options.force) throw error;
    }
  }
  return {load};
})();
