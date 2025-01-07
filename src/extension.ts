
import * as vscode from 'vscode';
import axios from 'axios'; // API di OpenAI

export function activate(context: vscode.ExtensionContext) {
    const addBreakpointsCommand = vscode.commands.registerCommand('openaiDebugger.addBreakpoints', async () => {
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
            const breakpoints = await analyzeCodeWithOpenAI(prompt, code);
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

async function analyzeCodeWithOpenAI(prompt: string, code: string): Promise<number[]> {
    const apiKey = 'ADD_YOUR_OPENAPI_KEY'; // Read from secure configuration
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
