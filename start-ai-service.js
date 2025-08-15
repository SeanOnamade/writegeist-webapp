#!/usr/bin/env node
/**
 * Dedicated AI service starter with proper embedding management.
 * This script starts the AI service and ensures embeddings are ready.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function findPythonExecutable() {
    const venvPath = path.join(__dirname, 'ai-service', '.venv');
    
    if (fs.existsSync(venvPath)) {
        const pythonExe = process.platform === 'win32' 
            ? path.join(venvPath, 'Scripts', 'python.exe')
            : path.join(venvPath, 'bin', 'python');
        
        if (fs.existsSync(pythonExe)) {
            return pythonExe;
        }
    }
    
    // Fallback to system Python
    return process.platform === 'win32' ? 'python' : 'python3';
}

function checkServiceHealth() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 8000,
            path: '/embeddings/status',
            method: 'GET',
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const status = JSON.parse(data);
                    resolve({ healthy: true, status });
                } catch (e) {
                    resolve({ healthy: false, error: 'Invalid JSON response' });
                }
            });
        });
        
        req.on('error', (error) => {
            resolve({ healthy: false, error: error.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ healthy: false, error: 'Timeout' });
        });
        
        req.end();
    });
}

function rebuildEmbeddings() {
    return new Promise((resolve, reject) => {
        log('[REBUILDING] Starting embedding rebuild process...', colors.yellow);
        
        const pythonExe = findPythonExecutable();
        const aiServicePath = path.join(__dirname, 'ai-service');
        
        const rebuildProcess = spawn(pythonExe, ['rebuild_embeddings.py'], {
            cwd: aiServicePath,
            stdio: 'inherit'
        });
        
        rebuildProcess.on('close', (code) => {
            if (code === 0) {
                log('[SUCCESS] Embedding rebuild completed!', colors.green);
                resolve();
            } else {
                log(`[ERROR] Embedding rebuild failed with code ${code}`, colors.red);
                reject(new Error(`Rebuild failed with code ${code}`));
            }
        });
        
        rebuildProcess.on('error', (error) => {
            log(`[ERROR] Rebuild process error: ${error.message}`, colors.red);
            reject(error);
        });
    });
}

function startAIService() {
    return new Promise((resolve, reject) => {
        log('[STARTING] Starting AI service...', colors.blue);
        
        const pythonExe = findPythonExecutable();
        const aiServicePath = path.join(__dirname, 'ai-service');
        
        // Start the AI service
        const aiProcess = spawn(pythonExe, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
            cwd: aiServicePath,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let startupComplete = false;
        let healthCheckInterval;
        
        aiProcess.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(`${colors.cyan}[AI]${colors.reset} ${output}`);
            
            // Check for startup indicators
            if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
                if (!startupComplete) {
                    startupComplete = true;
                    
                    // Start health checking
                    healthCheckInterval = setInterval(async () => {
                        const health = await checkServiceHealth();
                        if (health.healthy) {
                            clearInterval(healthCheckInterval);
                            log('[SUCCESS] AI service is healthy and ready!', colors.green);
                            
                            if (health.status.needs_sync) {
                                log(`[INFO] ${health.status.chapters_without_embeddings} chapters need embeddings`, colors.yellow);
                                log('[INFO] Embeddings will be generated on first story chat request', colors.yellow);
                            }
                            
                            resolve(aiProcess);
                        }
                    }, 2000);
                }
            }
        });
        
        aiProcess.stderr.on('data', (data) => {
            const output = data.toString();
            process.stderr.write(`${colors.red}[AI ERROR]${colors.reset} ${output}`);
        });
        
        aiProcess.on('error', (error) => {
            log(`[ERROR] Failed to start AI service: ${error.message}`, colors.red);
            if (healthCheckInterval) clearInterval(healthCheckInterval);
            reject(error);
        });
        
        aiProcess.on('close', (code) => {
            if (healthCheckInterval) clearInterval(healthCheckInterval);
            if (code !== 0) {
                log(`[ERROR] AI service exited with code ${code}`, colors.red);
                reject(new Error(`AI service exited with code ${code}`));
            }
        });
        
        // Timeout after 90 seconds
        setTimeout(() => {
            if (!startupComplete) {
                if (healthCheckInterval) clearInterval(healthCheckInterval);
                log('[TIMEOUT] AI service startup timeout', colors.red);
                reject(new Error('AI service startup timeout'));
            }
        }, 90000);
    });
}

async function main() {
    const args = process.argv.slice(2);
    const shouldRebuild = args.includes('--rebuild');
    
    log('[STARTING] Writegeist AI Service Manager', colors.bright);
    log('=' * 50);
    
    try {
        // Step 1: Rebuild embeddings if requested
        if (shouldRebuild) {
            await rebuildEmbeddings();
        }
        
        // Step 2: Start AI service
        const aiProcess = await startAIService();
        
        // Step 3: Handle shutdown
        const shutdown = () => {
            log('\n[SHUTDOWN] Stopping AI service...', colors.yellow);
            
            if (aiProcess) {
                aiProcess.kill('SIGTERM');
                
                // Force kill after 5 seconds
                setTimeout(() => {
                    if (!aiProcess.killed) {
                        aiProcess.kill('SIGKILL');
                    }
                }, 5000);
            }
            
            process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        
        // Keep running
        log('[RUNNING] AI service is running. Press Ctrl+C to stop.', colors.green);
        
    } catch (error) {
        log(`[ERROR] ${error.message}`, colors.red);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
} 