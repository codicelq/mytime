import * as vscode from 'vscode';
import { newTaskLine, summaryBlock, newDayBlock } from './taskUtils';

Object.defineProperty(exports, "__esModule", { value: true });

export function activate(context: vscode.ExtensionContext) {
	//console.log('Congratulations, your extension "mytime" is now active!');

	context.subscriptions.push(newDay());
	context.subscriptions.push(newTask(context));
	context.subscriptions.push(newBreak(context));
	context.subscriptions.push(summary());

}

// this method is called when your extension is deactivated
export function deactivate() { }

/// ----

export function newDay() {
	return vscode.commands.registerCommand('mytime.newDay', () => newDayBlock());
}

export function newTask(context: vscode.ExtensionContext) {
	return vscode.commands.registerCommand('mytime.newTask', async () => newTaskLine(context,false) );
}

export function newBreak(context: vscode.ExtensionContext) {
	return vscode.commands.registerCommand('mytime.newBreak', async () => newTaskLine(context,true) );
}

export function summary() {
	return vscode.commands.registerCommand('mytime.summary', () => summaryBlock());
}
