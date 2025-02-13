#!/usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkForUpdates() {
  const { version: currentVersion } = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  return new Promise((resolve) => {
    https.get('https://registry.npmjs.org/@uomi-network/wasp', (res) => {
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      
      res.on('end', () => {
        try {
          const { 'dist-tags': { latest } } = JSON.parse(data);
          
          if (latest !== currentVersion) {
            console.log(chalk.yellow(`\nNew version available! ${currentVersion} → ${latest}`));
            console.log(chalk.cyan('Run: npm install -g @uomi-network/wasp@latest to update\n'));
          }
        } catch (error) {
          // Silently fail version check
        }
        resolve();
      });
    }).on('error', () => resolve());
  });
}

async function main() {
  await checkForUpdates();
  console.log(chalk.yellow(`
░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓██████▓▒░ ░▒▓███████▓▒░▒▓███████▓▒░  
░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓████████▓▒░░▒▓██████▓▒░░▒▓███████▓▒░  
░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░        
░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░      ░▒▓█▓▒░▒▓█▓▒░        
 ░▒▓█████████████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓███████▓▒░░▒▓█▓▒░        
  `));
  console.log(chalk.cyan('UOMI Agent Development Environment Setup\n'));

  // Check prerequisites
  await checkPrerequisites();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'What is your project name?',
      default: 'my-uomi-agent',
      validate: input => {
        if (/^[a-zA-Z0-9-_]+$/.test(input)) return true;
        return 'Project name may only include letters, numbers, underscores and hashes';
      }
    },
    {
      type: 'list',
      name: 'template',
      message: 'Which template would you like to use?',
      choices: [
        'LLM Chat',
      ],
      default: 'LLM Chat'
    }
  ]);

  const spinner = ora('Setting up your project...').start();

  try {
    // Create project directory
    const projectPath = path.join(process.cwd(), answers.projectName);
    await fs.ensureDir(projectPath);

    // Copy templates
    const templatePath = path.join(__dirname, 'agent');
    await fs.copy(templatePath, projectPath);

    // Copy .gitignore from templatePath (since it's not copied by fs.copy)
    await fs.copyFile(path.join(templatePath, 'gitignore'), path.join(projectPath, '.gitignore'));

    // Customize files
    await customizeTemplateFiles(projectPath, answers);

    // Initialize git
    spinner.text = 'Initializing git repository...';
    execSync('git init', { cwd: projectPath });

    // Install dependencies
    spinner.text = 'Installing dependencies...';
    execSync('npm install', { cwd: projectPath });

    // Verify Rust
    spinner.text = 'Setting up Rust environment...';
    execSync('rustup target add wasm32-unknown-unknown');

    spinner.succeed(chalk.green('Project setup complete!'));

    console.log('\n' + chalk.cyan('Next steps:'));
    console.log(chalk.white(`
    1. cd ${answers.projectName}
    2. npm run start
    
    Start building your UOMI agent! 🚀
    `));

  } catch (error) {
    spinner.fail(chalk.red('Error setting up project'));
    console.error(error);
    process.exit(1);
  }
}

async function checkPrerequisites() {
  const spinner = ora('Checking prerequisites...').start();
  
  try {
    // Verify Node.js
    const nodeVersion = process.version;
    if (parseInt(nodeVersion.slice(1)) < 14) {
      throw new Error('Node.js 14 or higher is required');
    }

    // Verify Rust
    execSync('rustc --version');

    // Verify Cargo
    execSync('cargo --version');

    spinner.succeed(chalk.green('Prerequisites met!'));
  } catch (error) {
    spinner.fail(chalk.red('Missing prerequisites'));
    console.log(chalk.yellow('\nPlease ensure you have installed:'));
    console.log('1. Node.js 14 or higher (https://nodejs.org)');
    console.log('2. Rust (https://rustup.rs)');
    process.exit(1);
  }
}

async function customizeTemplateFiles(projectPath, answers) {
  const spinner = ora('Customizing project files...').start();
  
  try {
    const cargoTomlPath = path.join(projectPath + "/agent-template", 'Cargo.toml');
    let cargoToml = await fs.readFile(cargoTomlPath, 'utf8');
    cargoToml = cargoToml.replace('agent-template', answers.projectName);
    await fs.writeFile(cargoTomlPath, cargoToml);

    spinner.succeed(chalk.green('Project files customized'));
  } catch (error) {
    spinner.fail(chalk.red('Error customizing project files'));
    throw error;
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'create') {
  checkForUpdates()
    .then(() => main())
    .catch((error) => {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    });
} else {
  console.log(chalk.yellow('\nUsage: wasp create'));
  console.log(chalk.cyan('\nAvailable commands:'));
  console.log('  create    Create a new UOMI agent project');
  process.exit(1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled rejection:'), error);
  process.exit(1);
});