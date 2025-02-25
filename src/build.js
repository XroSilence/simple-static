import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import markdown from 'markdown-it';
import matter from 'gray-matter';
import hljs from 'highlight.js';
import ejs from 'ejs';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build the static site
 */
async function buildSite(options) {
  const spinner = ora('Building site...').start();
  try {
    const cwd = process.cwd();
    const configPath = path.resolve(cwd, options.config);
    
    // Import config dynamically
    const configUrl = `file://${configPath}`;
    const config = (await import(configUrl)).default;
    
    const contentDir = path.resolve(cwd, options.source);
    const outputDir = path.resolve(cwd, options.output);
    const themeDir = path.resolve(cwd, 'themes', config.theme || 'default');
    
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    
    // Clear output directory
    await fs.emptyDir(outputDir);
    
    // Copy static files from public directory
    const publicDir = path.resolve(cwd, 'public');
    if (await fs.pathExists(publicDir)) {
      await fs.copy(publicDir, outputDir);
    }
    
    // Setup markdown parser
    const md = setupMarkdown(config);
    
    // Process markdown files
    const pages = await processMarkdownFiles(contentDir, md);
    
    // Generate static HTML files
    await generateHtmlFiles(pages, config, themeDir, outputDir);
    
    spinner.succeed(`Site built successfully to ${outputDir}`);
    return { outputDir, pageCount: pages.length };
  } catch (error) {
    spinner.fail('Build failed');
    console.error(error);
    throw error;
  }
}

/**
 * Setup markdown parser with configs
 */
function setupMarkdown(config) {
  const options = {
    html: true,
    breaks: false,
    linkify: true,
    ...config.markdown
  };
  
  const md = markdown(options);
  
  // Add syntax highlighting if enabled
  if (config.markdown?.highlightCode !== false) {
    md.set({
      highlight: function(str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
          } catch (__) {}
        }
        
        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
      }
    });
  }
  
  return md;
}

/**
 * Process all markdown files in the content directory
 */
async function processMarkdownFiles(contentDir, md) {
  const pages = [];
  
  if (!await fs.pathExists(contentDir)) {
    return pages;
  }
  
  async function processDirectory(dir, baseUrl = '/') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Process subdirectories recursively
        const subDirUrl = path.join(baseUrl, entry.name, '/');
        await processDirectory(fullPath, subDirUrl);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Process markdown files
        const content = await fs.readFile(fullPath, 'utf-8');
        const { data, content: markdownContent } = matter(content);
        
        // Generate slug from filename
        const basename = path.basename(entry.name, '.md');
        const slug = data.slug || basename;
        
        // Generate URL path
        const urlPath = path.join(baseUrl, slug);
        
        // Convert markdown to HTML
        const html = md.render(markdownContent);
        
        pages.push({
          title: data.title || slug,
          date: data.date,
          tags: data.tags || [],
          slug,
          urlPath,
          content: html,
          excerpt: data.excerpt || extractExcerpt(markdownContent),
          frontmatter: data,
          sourcePath: fullPath
        });
      }
    }
  }
  
  await processDirectory(contentDir);
  
  // Sort pages by date (newest first)
  pages.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return pages;
}

/**
 * Extract excerpt from markdown content
 */
function extractExcerpt(markdown, length = 160) {
  // Remove markdown formatting
  let text = markdown
    .replace(/#+\s+(.*)/g, '$1') // Replace headers
    .replace(/!\[(.*?)\]\(.*?\)/g, '') // Remove images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Replace links with just text
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Remove bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Remove italic
    .replace(/`{3}[\s\S]*?`{3}/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
  
  // Truncate to specified length
  if (text.length > length) {
    return text.substring(0, length).trim() + '...';
  }
  
  return text;
}

/**
 * Generate HTML files from templates and content
 */
async function generateHtmlFiles(pages, config, themeDir, outputDir) {
  const layoutsDir = path.join(themeDir, 'layouts');
  
  // Check if layouts directory exists, if not use default layouts
  let layoutsPath = layoutsDir;
  if (!await fs.pathExists(layoutsPath)) {
    layoutsPath = path.join(__dirname, '../templates/default/layouts');
  }
  
  // Get templates
  const pageTemplate = await fs.readFile(path.join(layoutsPath, 'page.ejs'), 'utf-8');
  const indexTemplate = await fs.readFile(path.join(layoutsPath, 'index.ejs'), 'utf-8');
  
  // Generate individual page files
  for (const page of pages) {
    const outputPath = path.join(outputDir, page.urlPath.replace(/^\//, ''), 'index.html');
    await fs.ensureDir(path.dirname(outputPath));
    
    const html = ejs.render(pageTemplate, {
      page,
      site: config.site,
      pages
    });
    
    await fs.writeFile(outputPath, html);
  }
  
  // Generate index page
  const indexPath = path.join(outputDir, 'index.html');
  const indexHtml = ejs.render(indexTemplate, {
    pages,
    site: config.site
  });
  
  await fs.writeFile(indexPath, indexHtml);
  
  // Generate tag pages if any pages have tags
  const tags = new Set();
  pages.forEach(page => {
    if (page.tags && Array.isArray(page.tags)) {
      page.tags.forEach(tag => tags.add(tag));
    }
  });
  
  if (tags.size > 0) {
    const tagDir = path.join(outputDir, 'tags');
    await fs.ensureDir(tagDir);
    
    // Try to load tag template, fallback to index template
    let tagTemplate;
    try {
      tagTemplate = await fs.readFile(path.join(layoutsPath, 'tag.ejs'), 'utf-8');
    } catch (err) {
      tagTemplate = indexTemplate;
    }
    
    for (const tag of tags) {
      const tagPages = pages.filter(page => page.tags && page.tags.includes(tag));
      const tagPath = path.join(tagDir, `${tag}.html`);
      
      const tagHtml = ejs.render(tagTemplate, {
        pages: tagPages,
        tag,
        site: config.site
      });
      
      await fs.writeFile(tagPath, tagHtml);
    }
    
    // Generate tags index page
    const tagsIndexPath = path.join(tagDir, 'index.html');
    const tagsData = Array.from(tags).map(tag => ({
      name: tag,
      count: pages.filter(page => page.tags && page.tags.includes(tag)).length
    }));
    
    let tagsIndexTemplate;
    try {
      tagsIndexTemplate = await fs.readFile(path.join(layoutsPath, 'tags.ejs'), 'utf-8');
    } catch (err) {
      tagsIndexTemplate = indexTemplate;
    }
    
    const tagsIndexHtml = ejs.render(tagsIndexTemplate, {
      tags: tagsData,
      site: config.site
    });
    
    await fs.writeFile(tagsIndexPath, tagsIndexHtml);
  }
}

export default buildSite;
