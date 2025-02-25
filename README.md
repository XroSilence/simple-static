# Simple Static

A lightweight, easy-to-use static site generator for documentation sites and blogs.

## Features

- ✅ Markdown content with frontmatter support
- ✅ Code syntax highlighting
- ✅ Responsive design with light/dark mode
- ✅ Tag-based content organization
- ✅ Development server with live reload
- ✅ Clean, minimal templates
- ✅ Fast build times

## Installation

```bash
# Install globally
npm install -g simple-static

# Or use npx
npx simple-static <command>
```bash

## Quick Start

```bash
# Create a new site
simple-static init my-site

# Change to the site directory
cd my-site

# Install dependencies
npm install

# Start the development server
npm run serve

# Build for production
npm run build
```bash

## Usage

### Creating Content

Create Markdown files in the `content` directory. Each Markdown file should have frontmatter at the top:

```markdown
---
title: My Page Title
date: 2023-01-31
tags: [tag1, tag2]
---

# Content starts here

This is the content of your page.
```

### Configuration

Edit the `config.js` file in your site's root directory:

```javascript
export default {
  site: {
    title: 'My Site',
    description: 'My awesome site description',
    baseUrl: '/',
  },
  theme: 'default',
  markdown: {
    highlightCode: true,
  }
};
```

### Custom Themes

Create a new directory under `themes` with layout files:

```bash
themes/
  my-theme/
    layouts/
      index.ejs
      page.ejs
      tag.ejs
      tags.ejs
```

Then update your `config.js` to use your theme:

```javascript
export default {
  // ...
  theme: 'my-theme',
  // ...
};
```

### CLI Commands

```bash
# Initialize a new site
simple-static init <directory>

# Build the site
simple-static build [options]

# Start development server
simple-static serve [options]

# Show help
simple-static --help
```

## Options

### Build Options

- `-c, --config <path>` - Path to config file (default: `config.js`)
- `-o, --output <directory>` - Output directory (default: `dist`)
- `-s, --source <directory>` - Source content directory (default: `content`)

### Serve Options

- `-p, --port <number>` - Port to use (default: `3000`)
- `-c, --config <path>` - Path to config file (default: `config.js`)
- `-o, --output <directory>` - Output directory (default: `dist`)
- `-s, --source <directory>` - Source content directory (default: `content`)

## License

MIT

---

Created by Claude & XroSilence
