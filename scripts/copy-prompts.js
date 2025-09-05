import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const promptsDir = join(projectRoot, 'prompts');
const publicDir = join(projectRoot, 'public');
const outputDir = join(publicDir, 'prompts');

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });
mkdirSync(join(outputDir, 'en'), { recursive: true });
mkdirSync(join(outputDir, 'zh'), { recursive: true });

// Files to copy
const filesToCopy = [
  'en/base-system-instruction.txt',
  'en/dialogue-tool-description.txt',
  'zh/base-system-instruction.txt',
  'zh/dialogue-tool-description.txt'
];

console.log('Copying prompt files to public directory...');

filesToCopy.forEach(file => {
  try {
    const sourcePath = join(promptsDir, file);
    const destPath = join(outputDir, file);
    
    const content = readFileSync(sourcePath, 'utf-8');
    writeFileSync(destPath, content, 'utf-8');
    
    console.log(`✓ Copied ${file}`);
  } catch (error) {
    console.error(`✗ Failed to copy ${file}:`, error.message);
  }
});

console.log('Prompt files copying completed!');