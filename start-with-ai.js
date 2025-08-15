#!/usr/bin/env node
/**
 * Start script that launches both the AI service and the Electron app.
 * This replaces the need to manually start the AI service in a separate terminal.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

function startAIService() {
    return new Promise((resolve, reject) => {
        log('🚀 Starting Writegeist AI Service...', colors.blue);
        
        const pythonExe = findPythonExecutable();
        const aiServicePath = path.join(__dirname, 'ai-service');
        
        // Start the AI service
        const aiProcess = spawn(pythonExe, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'], {
            cwd: aiServicePath,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let startupComplete = false;
        
        aiProcess.stdout.on('data', (data) => {
            const output = data.toString();
            
            // Color AI service output
            process.stdout.write(`${colors.cyan}[AI]${colors.reset} ${output}`);
            
            // Check if startup is complete
            if (output.includes('Application startup complete') && !startupComplete) {
                startupComplete = true;
                log('✅ AI Service is ready!', colors.green);
                resolve(aiProcess);
            }
        });
        
        aiProcess.stderr.on('data', (data) => {
            const output = data.toString();
            process.stderr.write(`${colors.red}[AI ERROR]${colors.reset} ${output}`);
        });
        
        aiProcess.on('error', (error) => {
            log(`❌ Failed to start AI service: ${error.message}`, colors.red);
            reject(error);
        });
        
        aiProcess.on('close', (code) => {
            if (code !== 0) {
                log(`❌ AI service exited with code ${code}`, colors.red);
                reject(new Error(`AI service exited with code ${code}`));
            }
        });
        
        // Timeout after 60 seconds (embeddings can take time)
        setTimeout(() => {
            if (!startupComplete) {
                log('⏰ AI service startup timeout (but continuing...)', colors.yellow);
                log('   Embeddings may still be generating in background', colors.yellow);
                resolve(aiProcess); // Continue anyway
            }
        }, 60000);
    });
}

function startElectronApp() {
    return new Promise((resolve, reject) => {
        log('🖥️ Starting Electron app...', colors.magenta);
        
        const electronProcess = spawn('npm', ['run', 'start-electron-only'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            env: {
                ...process.env,
                SKIP_AI_SERVICE: 'true'  // Tell Electron not to start its own AI service
            }
        });
        
        electronProcess.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(`${colors.magenta}[ELECTRON]${colors.reset} ${output}`);
        });
        
        electronProcess.stderr.on('data', (data) => {
            const output = data.toString();
            process.stderr.write(`${colors.red}[ELECTRON ERROR]${colors.reset} ${output}`);
        });
        
        electronProcess.on('error', (error) => {
            log(`❌ Failed to start Electron app: ${error.message}`, colors.red);
            reject(error);
        });
        
        electronProcess.on('close', (code) => {
            log(`🖥️ Electron app exited with code ${code}`, colors.magenta);
            resolve(code);
        });
        
        resolve(electronProcess);
    });
}

async function main() {
    log('🌟 Starting Writegeist with AI Service...', colors.bright);
    
    let aiProcess = null;
    let electronProcess = null;
    
    try {
        // Start AI service first
        aiProcess = await startAIService();
        
        // Give it a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start Electron app
        electronProcess = await startElectronApp();
        
        // Handle shutdown
        const shutdown = () => {
            log('\n🛑 Shutting down...', colors.yellow);
            
            if (electronProcess) {
                electronProcess.kill();
            }
            
            if (aiProcess) {
                aiProcess.kill();
            }
            
            process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        
        // Wait for Electron to close
        await new Promise(resolve => {
            if (electronProcess) {
                electronProcess.on('close', resolve);
            } else {
                resolve();
            }
        });
        
    } catch (error) {
        log(`❌ Error: ${error.message}`, colors.red);
        
        // Clean up processes
        if (aiProcess) {
            aiProcess.kill();
        }
        if (electronProcess) {
            electronProcess.kill();
        }
        
        process.exit(1);
    }
}

if (require.main === module) {
    main();
} 