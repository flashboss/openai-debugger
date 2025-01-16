
import * as vscode from 'vscode';
import axios from 'axios'; // Calling API OpenAI

export function activate(context: vscode.ExtensionContext) {
    const addBreakpointsCommand = vscode.commands.registerCommand('openaiDebugger.addBreakpoints', async () => {

        let apiKey = context.globalState.get<string>('openaiApiKey');
        
        // Se non c'è una API key salvata, richiedila all'utente
        if (!apiKey) {
            apiKey = await vscode.window.showInputBox({
                prompt: 'Please enter your OpenAI API key',
                password: true, // Mostra come password per sicurezza
            });

            if (!apiKey) {
                vscode.window.showErrorMessage('API key is required.');
                return;
            }

            try {
                const isValidApiKey = await verifyApiKey(apiKey);
                if (!isValidApiKey) {
                    vscode.window.showErrorMessage('Invalid API key. Please enter a valid key.');
                    return;
                }
            } catch (error) {
                vscode.window.showErrorMessage('Error verifying API key.');
                return;
            }

            // Salva l'API key nel global state per utilizzi futuri
            await context.globalState.update('openaiApiKey', apiKey);
            vscode.window.showInformationMessage('API key has been saved.');
        }

        const prompt = await vscode.window.showInputBox({
            prompt: 'Tell me what do you need to add as breakpoint',
        });

        if (!prompt) {
            vscode.window.showErrorMessage('Prompt not available.');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No file opened.');
            return;
        }

        const code = editor.document.getText();
        vscode.window.showInformationMessage('Running analysis code...');

        try {
            const breakpoints = await analyzeCodeWithOpenAI(prompt, code, apiKey);
            addBreakpointsToDebugger(editor, breakpoints);
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error in analysis: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('Unknown error in analysis.');
            }
        }
    });

    context.subscriptions.push(addBreakpointsCommand);
}

async function verifyApiKey(apiKey: string): Promise<boolean> {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/models',
            {},
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

async function analyzeCodeWithOpenAI(prompt: string, code: string, apiKey: string): Promise<number[]> {
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are an assistant debugger AI.' },
                { role: 'user', content: `${prompt}\n\nCode:\n${code}` },
            ],
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const analysis = response.data.choices[0].message.content;
    return parseBreakpointsFromAnalysis(analysis);
}

function parseBreakpointsFromAnalysis(analysis: string): number[] {
    const lines: number[] = [];
    const regex = /line (\d+)/gi; // Search "line X" in the result
    let match;
    while ((match = regex.exec(analysis)) !== null) {
        lines.push(parseInt(match[1], 10));
    }
    return lines;
}

function addBreakpointsToDebugger(editor: vscode.TextEditor, lines: number[]) {
    const debugConfig = vscode.debug;
    const breakpoints = lines.map((line) => {
        const position = new vscode.Position(line - 1, 0); // Lines in VS Code are 0-based
        const location = new vscode.Location(editor.document.uri, position);
        return new vscode.SourceBreakpoint(location);
    });

    debugConfig.breakpoints = [...debugConfig.breakpoints, ...breakpoints];
    vscode.window.showInformationMessage(`Added ${lines.length} breakpoint.`);
}

export function deactivate() {}
