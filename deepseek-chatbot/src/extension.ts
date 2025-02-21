import * as vscode from 'vscode';
import ollama from 'ollama';

// Interface for error handling
interface OllamaError {
    message: string;
    error?: string;
    status_code?: number;
}

const MODEL_NAME = 'deepseek-coder:latest';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "deepseek-chatbot" is now active!');

    const disposable = vscode.commands.registerCommand('deepseek-chatbot.helloWorld', async () => {
        const panel = vscode.window.createWebviewPanel(
            'deepseek-chatbot',
            'DeepSeek Chatbot',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        try {
            await ensureModelExists();
        } catch (error) {
            const err = error as OllamaError;
            vscode.window.showErrorMessage(`Failed to initialize model: ${err.message || 'Unknown error'}`);
            return;
        }

        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'chat') {
                const userprompt = message.text;
                let responsetext = '';
                
                panel.webview.postMessage({ 
                    command: 'updateStatus', 
                    text: 'Processing your request...' 
                });

                try {
                    const streamResponse = await ollama.chat({
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
                    const err = error as OllamaError;
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

async function ensureModelExists(): Promise<void> {
    try {
        const models = await ollama.list();
        const modelExists = models.models.some(m => m.name === MODEL_NAME);

        if (!modelExists) {
            vscode.window.showInformationMessage(`Pulling ${MODEL_NAME} model. This may take a few minutes...`);
            await ollama.pull({
                model: MODEL_NAME
            });
            vscode.window.showInformationMessage(`Successfully pulled ${MODEL_NAME} model`);
        }
    } catch (error) {
        const err = error as OllamaError;
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

export function deactivate() {}