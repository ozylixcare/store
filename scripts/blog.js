// Public article actions load the blog feature on demand.
async function openBlog(id) {
  try {
    const modules = await ensureOzylixModules();
    await modules.load('blog');
    window.OzylixBlogPage.openBlog(id);
  } catch(error) { showToast('Article could not load. Please try again.','error'); }
}
async function openBlogBySlug(slug) {
  try {
    const modules = await ensureOzylixModules();
    await modules.load('blog');
    window.OzylixBlogPage.openBlogBySlug(slug);
  } catch(error) { showToast('Article could not load. Please try again.','error'); }
}
function closeBlog() {
  if (window.OzylixBlogPage) window.OzylixBlogPage.closeBlog();
}
