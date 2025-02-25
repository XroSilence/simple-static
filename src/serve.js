import express from 'express';
import path from 'path';
import chokidar from 'chokidar';
import buildSite from './build.js';
import fs from 'fs-extra';
import ora from 'ora';

/**
 * Start a development server with live reload
 */
async function serveSite(options) {
  const port = parseInt(options.port, 10);
  const cwd = process.cwd();
  const contentDir = path.resolve(cwd, options.source);
  const publicDir = path.resolve(cwd, 'public');
  const themesDir = path.resolve(cwd, 'themes');
  
  console.log(`Starting development server...`);
  
  // Build the site first
  const { outputDir } = await buildSite(options);
  
  // Create express app
  const app = express();
  
  // Serve static files
  app.use(express.static(outputDir));
  
  // Start server
  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
  
  // Set up file watcher
  const spinner = ora('Watching for changes...').start();
  
  // Watch for changes in content, public, and themes directories
  const watchDirs = [
    contentDir,
    publicDir,
    themesDir,
    path.resolve(cwd, options.config)
  ].filter(dir => fs.pathExistsSync(dir));
  
  const watcher = chokidar.watch(watchDirs, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true
  });
  
  let rebuilding = false;
  let pendingRebuild = false;
  
  async function rebuildSite() {
    if (rebuilding) {
      pendingRebuild = true;
      return;
    }
    
    rebuilding = true;
    spinner.text = 'Rebuilding site...';
    
    try {
      await buildSite(options);
      spinner.succeed('Site rebuilt successfully');
      console.log(`Server running at http://localhost:${port}`);
    } catch (error) {
      spinner.fail('Rebuild failed');
      console.error(error);
    } finally {
      rebuilding = false;
      spinner.text = 'Watching for changes...';
      spinner.start();
      
      if (pendingRebuild) {
        pendingRebuild = false;
        rebuildSite();
      }
    }
  }
  
  watcher.on('change', path => {
    spinner.text = `File changed: ${path}`;
    rebuildSite();
  });
  
  watcher.on('add', path => {
    spinner.text = `File added: ${path}`;
    rebuildSite();
  });
  
  watcher.on('unlink', path => {
    spinner.text = `File deleted: ${path}`;
    rebuildSite();
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    spinner.stop();
    server.close();
    watcher.close();
    console.log('Development server stopped');
    process.exit(0);
  });
  
  return { server, watcher, port };
}

export default serveSite;
