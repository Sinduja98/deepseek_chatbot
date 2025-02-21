"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ollama_1 = __importDefault(require("ollama"));
const MODEL_NAME = 'deepseek-coder:latest';
function activate(context) {
    console.log('Congratulations, your extension "deepseek-chatbot" is now active!');
    const disposable = vscode.commands.registerCommand('deepseek-chatbot.helloWorld', async () => {
        const panel = vscode.window.createWebviewPanel('deepseek-chatbot', 'DeepSeek Chatbot', vscode.ViewColumn.One, { enableScripts: true });
        try {
            await ensureModelExists();
        }
        catch (error) {
            const err = error;
            vscode.window.showErrorMessage(`Failed to initialize model: ${err.message || 'Unknown error'}`);
            return;
        }
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'chat') {
                const userprompt = message.text;
                let responsetext = '';
                panel.webview.postMessage({
                    command: 'updateStatus',
                    text: 'Processing your request...'
                });
                try {
                    const streamResponse = await ollama_1.default.chat({
                        model: MODEL_NAME,
                        messages: [{ role: 'user', content: userprompt }],
                        stream: true
                    });
                    for await (const chunk of streamResponse) {
                        responsetext += chunk.message.content;
                        panel.webview.postMessage({
                            command: 'chatResponse',
                            text: responsetext
                        });
                    }
                }
                catch (error) {
                    const err = error;
                    console.error('Error:', err);
                    panel.webview.postMessage({
                        command: 'error',
                        text: `Error: ${err.message || err.error || 'Unknown error occurred'}`
                    });
                }
            }
        });
        panel.webview.html = getWebviewContent();
    });
    context.subscriptions.push(disposable);
}
async function ensureModelExists() {
    try {
        const models = await ollama_1.default.list();
        const modelExists = models.models.some(m => m.name === MODEL_NAME);
        if (!modelExists) {
            vscode.window.showInformationMessage(`Pulling ${MODEL_NAME} model. This may take a few minutes...`);
            await ollama_1.default.pull({
                model: MODEL_NAME
            });
            vscode.window.showInformationMessage(`Successfully pulled ${MODEL_NAME} model`);
        }
    }
    catch (error) {
        const err = error;
        throw new Error(`Failed to initialize model: ${err.message || err.error || 'Unknown error'}`);
    }
}
function getWebviewContent() {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <style>
            body {
                font-family: sans-serif;
                margin: 1rem;
                padding: 1rem;
            }
            textarea#prompt {
                width: 100%;
                box-sizing: border-box;
                min-height: 30px;
                margin-bottom: 1rem;
                padding: 0.5rem;
                border: 1px solid #ccc;
                border-radius: 4px;
            }
            #askBtn {
                padding: 0.5rem 1rem;
                background-color: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            #askBtn:hover {
                background-color: #005999;
            }
            #askBtn:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
            #response {
                border: 1px solid #ccc;
                margin-top: 1rem;
                padding: 1rem;
                min-height: 100px;
                border-radius: 4px;
                background-color:black;
				color: white;
                white-space: pre-wrap;
            }
            .error {
                color: #dc3545;
                background-color: #f8d7da;
                border-color: #f5c6cb;
            }
        </style>
    </head>
    <body>
        <h2>DeepSeek Chatbot</h2>
        <textarea id="prompt" placeholder="Ask something..."></textarea>
        <button id="askBtn">Ask</button>
        <div id="response" placeholder="Chat Response..."></div>
        <script>
            const vscode = acquireVsCodeApi();
            const askBtn = document.getElementById('askBtn');
            const responseDiv = document.getElementById('response');
            
            askBtn.addEventListener('click', async () => {
                const text = document.getElementById('prompt').value;
                if (text.trim()) {
                    askBtn.disabled = true;
                    responseDiv.className = '';
                    responseDiv.innerText = 'Processing your request...';
                    vscode.postMessage({ command: 'chat', text });
                }
            });

            window.addEventListener('message', event => {
                const { command, text } = event.data;
                
                switch(command) {
                    case 'chatResponse':
                        responseDiv.innerText = text;
                        askBtn.disabled = false;
                        break;
                    case 'error':
                        responseDiv.innerText = text;
                        responseDiv.className = 'error';
                        askBtn.disabled = false;
                        break;
                    case 'updateStatus':
                        responseDiv.innerText = text;
                        break;
                }
            });
        </script>
    </body>
    </html>
    `;
}
function deactivate() { }
//# sourceMappingURL=extension.js.map