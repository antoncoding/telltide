import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🌊 Starting TellTide Server...\n');

const processes: Array<{ name: string; child: ReturnType<typeof spawn> }> = [];

function startProcess(name: string, scriptPath: string) {
  console.log(`Starting ${name}...`);

  const child = spawn('tsx', [scriptPath], {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
  });

  child.on('error', (error) => {
    console.error(`❌ ${name} error:`, error);
  });

  child.on('exit', (code) => {
    console.log(`${name} exited with code ${code}`);
  });

  processes.push({ name, child });
}

// Start all services
startProcess('Indexer', join(__dirname, 'indexer/index.ts'));
startProcess('Worker', join(__dirname, 'worker/index.ts'));
startProcess('API', join(__dirname, 'api/index.ts'));

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down all services...');

  processes.forEach(({ name, child }) => {
    console.log(`Stopping ${name}...`);
    child.kill();
  });

  process.exit(0);
});
