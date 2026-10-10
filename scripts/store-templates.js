/* Shared storefront templates. Publishing uses the existing authenticated theme API. */
(function (root) {
  'use strict';
  var templates = {
    classic: { name: 'Original Crimson', description: 'The original Ozylix colours and warm white surfaces.', palette: {
      paper:'#F5F3F4', paperHi:'#FFFFFF', paperLo:'#E9E5E7', white:'#FFFFFF',
      brand:'#C0394A', brandDeep:'#8E2333', brandHi:'#D7535D', secondary:'#6B5560', secondaryHi:'#EBD9DC',
      ink:'#16121A', inkMid:'#46404A', tHi:'#16121A', tMid:'#5A5560', tLow:'#6B6570',
      flavour1:'#C0394A', flavour2:'#46404A', flavour3:'#C0304A', flavour4:'#6B5560'
    } },
    'sage-olive': { name: 'White & Sage', description: 'Deep olive actions, sage accents and alternating white and soft-white sections.', palette: {
      paper:'#E8E9DF', paperHi:'#FFFFFF', paperLo:'#DCE0D0', white:'#FFFFFF',
      brand:'#2E3D28', brandDeep:'#24301F', brandHi:'#A9B887', secondary:'#526346', secondaryHi:'#DAE1CC',
      ink:'#2E3D28', inkMid:'#526346', tHi:'#2E3D28', tMid:'#526047', tLow:'#5F6855',
      flavour1:'#2E3D28', flavour2:'#526346', flavour3:'#A9B887', flavour4:'#526346'
    } }
  };
  function makeTheme(key) {
    key = Object.prototype.hasOwnProperty.call(templates,key) ? key : 'classic';
    return {template:key, palette:JSON.parse(JSON.stringify(templates[key].palette)), paletteRevision:2,
      radius:'default', shadows:'default', bubbles:'on', style:'default', combos:{},
      fonts:{display:"'Jost', sans-serif",body:"'Schibsted Grotesk', sans-serif"}};
  }
  var api = {templates:templates, makeTheme:makeTheme};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (root) root.OzylixStoreTemplates=api;
})(typeof window !== 'undefined' ? window : null);
