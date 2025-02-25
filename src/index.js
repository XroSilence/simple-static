#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';
import ora from 'ora';
import buildSite from './build.js';
import serveSite from './serve.js';

// Get the directory name correctly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('simple-static')
  .description('A simple static site generator for documentation and blogs')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new static site project')
  .argument('<directory>', 'Target directory for the new site')
  .action(async (directory) => {
    const spinner = ora('Creating new site project...').start();
    try {
      const targetDir = path.resolve(process.cwd(), directory);
      
      // Ensure directory exists
      await fs.ensureDir(targetDir);
      
      // Copy template files
      const templateDir = path.join(__dirname, '../templates/default');
      await fs.copy(templateDir, targetDir);
      
      // Create necessary directories
      const dirs = ['content', 'public', 'themes/default/layouts'];
      for (const dir of dirs) {
        await fs.ensureDir(path.join(targetDir, dir));
      }
      
      // Create a sample config file if it doesn't exist
      const configPath = path.join(targetDir, 'config.js');
      if (!await fs.pathExists(configPath)) {
        await fs.writeFile(
          configPath,
          `export default {
  site: {
    title: 'My New Site',
    description: 'Created with simple-static',
    baseUrl: '/',
  },
  theme: 'default',
  markdown: {
    highlightCode: true,
  }
};`
        );
      }
      
      // Create a sample post
      const samplePostDir = path.join(targetDir, 'content');
      await fs.ensureDir(samplePostDir);
      await fs.writeFile(
        path.join(samplePostDir, 'hello-world.md'),
        `---
title: Hello World
date: ${new Date().toISOString().split('T')[0]}
tags: [sample, hello]
---

# Hello World!

This is a sample post created by simple-static. You can edit this file or create new markdown files in the \`content\` directory.

## Features

- Markdown support
- Code highlighting
- Customizable themes
- Fast and simple

\`\`\`js
// Sample code
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
\`\`\`

Enjoy building with simple-static!
`
      );
      
      spinner.succeed('New site created successfully!');
      console.log(`
Next steps:
1. cd ${directory}
2. npm install (or yarn install)
3. npm run serve - to start development server
4. npm run build - to build the site for production
      `);
    } catch (error) {
      spinner.fail('Failed to create new site');
      console.error(error);
    }
  });

program
  .command('build')
  .description('Build the static site')
  .option('-c, --config <path>', 'Path to config file', 'config.js')
  .option('-o, --output <directory>', 'Output directory', 'dist')
  .option('-s, --source <directory>', 'Source content directory', 'content')
  .action(async (options) => {
    try {
      await buildSite(options);
    } catch (error) {
      console.error('Build failed:', error);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start development server')
  .option('-p, --port <number>', 'Port to use', '3000')
  .option('-c, --config <path>', 'Path to config file', 'config.js')
  .option('-o, --output <directory>', 'Output directory', 'dist')
  .option('-s, --source <directory>', 'Source content directory', 'content')
  .action(async (options) => {
    try {
      await serveSite(options);
    } catch (error) {
      console.error('Server failed:', error);
      process.exit(1);
    }
  });

program.parse();
