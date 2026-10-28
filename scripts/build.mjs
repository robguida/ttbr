import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const source = path.resolve(root, 'src');
const output = path.resolve(root, 'dist');
// Validate the exact output boundary before removing generated files.
if (path.dirname(output) !== root || path.basename(output) !== 'dist' || output === source) throw new Error('Unsafe output path');
if (existsSync(output) && (lstatSync(output).isSymbolicLink() || realpathSync(output) !== output)) throw new Error('Output must be a regular project directory');
function checkTree(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['docs', 'scripts', 'node_modules'].includes(entry.name)) throw new Error(`Non-deployable entry in src: ${entry.name}`);
    const filename = path.join(directory, entry.name);
    if (lstatSync(filename).isSymbolicLink()) throw new Error('Source symlinks are not supported');
    if (entry.isDirectory()) checkTree(filename);
    else if (!entry.isFile()) throw new Error('Source must contain regular files only');
  }
}
checkTree(source);
if (!existsSync(path.join(source, 'index.html'))) throw new Error('Missing src/index.html');
if (existsSync(output)) rmSync(output, { recursive: true });
mkdirSync(output);
cpSync(source, output, { recursive: true });
console.log('Built dist/ using only deployable files from src/.');
