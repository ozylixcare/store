// Explicit feature registry: shared in-flight loads, retries after failure.
window.OzylixModules = (() => {
  const registry = {
    reviews: {src:'/scripts/review-data.js?v=20261012-1', ready:()=>!!window.OzylixReviewData},
    cashfree: {src:'https://sdk.cashfree.com/js/v3/cashfree.js', ready:()=>typeof window.Cashfree === 'function'},
    blog: {src:'/scripts/blog-page.min.js?v=20261012-1', ready:()=>!!window.OzylixBlogPage},
    checkout: {src:'/scripts/payment-flow.min.js?v=20261012-1', ready:()=>!!window.OzylixPaymentFlow},
    account: {src:'/scripts/account-page.min.js?v=20261012-1', ready:()=>!!window.OzylixAccountPage},
  };
  const pending = new Map();
  function load(name) {
    const feature = registry[name];
    if (!feature) return Promise.reject(new Error('Unknown feature'));
    if (feature.ready()) return Promise.resolve();
    if (pending.has(name)) return pending.get(name);
    const task = new Promise((resolve,reject)=>{
      const script = document.createElement('script');
      const timer = setTimeout(()=>finish(new Error('Loading timed out. Please retry.')),20000);
      function finish(error) {
        clearTimeout(timer); script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); } else resolve();
      }
      script.src = feature.src; script.async = true;
      script.onload = ()=>finish(feature.ready() ? null : new Error('Feature failed to initialize'));
      script.onerror = ()=>finish(new Error('Could not load feature. Please retry.'));
      document.head.appendChild(script);
    });
    pending.set(name,task);
    task.catch(()=>{ if (pending.get(name) === task) pending.delete(name); });
    return task;
  }
  return {load};
})();
