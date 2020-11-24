import * as vscode from 'vscode';
import { enUS, it } from 'date-fns/locale';
import { format, addMinutes, differenceInMinutes, parse, Locale } from 'date-fns';

const _demoMode = false;
const _newLine = "\n";

Object.defineProperty(exports, "__esModule", { value: true });

export function activate(context: vscode.ExtensionContext) {
	//console.log('Congratulations, your extension "mytime" is now active!');

	context.subscriptions.push(newDay());
	context.subscriptions.push(newTask());
	context.subscriptions.push(newBreak());
	context.subscriptions.push(summary());

}

// this method is called when your extension is deactivated
export function deactivate() { }

/// ----

export function newDay() {
	return vscode.commands.registerCommand('mytime.newDay', () => newDayBlock());
}

export function newTask() {
	return vscode.commands.registerCommand('mytime.newTask', () => newTaskLine(false) );
}

export function newBreak() {
	return vscode.commands.registerCommand('mytime.newBreak', () => newTaskLine(true) );
}

export function summary() {
	return vscode.commands.registerCommand('mytime.summary', () => summaryBlock());
}

//----------------------------------------------

function newDayBlock() {
	let editor = vscode.window.activeTextEditor;
	if (editor === undefined) { return; }
	editor.edit((editBuilder) => {
		var d = new Date;
		if (editor === undefined) { return; }

		const locale = { locale: [enUS, it].find(x => { return x.code?.startsWith(getConfiguration('newDateLanguage')); }) };

		editBuilder.replace(editor.selection, "## "
			+ format(new Date(), getConfiguration('newDateFormat'), locale)
			+ _newLine
			+ _newLine
			+ new Task(getConfigurationRandomString('startMessage'), new Date()).toBreakLine()
			+ _newLine);

	}).then((success: any) => {
		if (editor === undefined) { return; }
		var cursorEndPosition = editor.selection.end;
		editor.selection = new vscode.Selection(cursorEndPosition, cursorEndPosition);
	});
} 

function newTaskLine (isBreak: Boolean) {
	let editor = vscode.window.activeTextEditor;
	let document = vscode.window.activeTextEditor?.document;
	let newTask: Task;

	if (editor === undefined || document === undefined) { return; }
	editor.edit((editBuilder) => {
		if (editor === undefined || document === undefined) { return false; }

		let startLine = editor.selection.start.line;

		try {
			let prevTask = Task.tryParseLine(document.lineAt(startLine - 1).text);
			if (prevTask === undefined) {
				newTask = new Task(getConfigurationRandomString('startMessage'), new Date());
			} else {
				let now = new Date();
				if (_demoMode) {
					now = addMinutes(prevTask.end as Date, getRandomInt(10, 91));
				}
				newTask = new Task(getConfigurationRandomString('taskPlaceholder'), prevTask.end as Date, now);
				newTask.text += ` (${TaskSpan.timeSpanToString(newTask.timeSpanMinutes(), getConfiguration('timeSpanFormat'), 0)})`;
			}
			let selection = new vscode.Selection(
				new vscode.Position(editor.selection.start.line, 0),
				editor.selection.end
			);
			if (isBreak) {
				editBuilder.replace(selection, newTask.toBreakLine());
			} else {
				editBuilder.replace(selection, newTask.toLine());
			}
		} catch (error) {
			vscode.window.showErrorMessage(error.message);
			return Promise.resolve(false);
		}
	}).then((success: any) => {
		if (editor === undefined || document === undefined) { return false; }
		if (isBreak) {
			var nextLine = editor.selection.end.line;
			var nextCharStart = editor.selection.end.character - newTask.text.length - 1;
			var nextCharEnd = editor.selection.end.character - 1;
			if (nextCharStart > 0) {
				editor.selection = new vscode.Selection(new vscode.Position(nextLine, nextCharStart), new vscode.Position(nextLine, nextCharEnd));
			}
		} else {
			var nextLine = editor.selection.end.line;
			var nextChar = editor.selection.end.character - newTask.text.length;
			if (nextChar > 0) {
				editor.selection = new vscode.Selection(new vscode.Position(nextLine, nextChar), editor.selection.end);
			}
		}
	});
}

function summaryBlock() {
	let editor = vscode.window.activeTextEditor;
	let document = vscode.window.activeTextEditor?.document;

	if (editor === undefined || document === undefined) { return; }
	editor.edit((editBuilder) => {
		if (editor === undefined || document === undefined) { return; }
		let startLine = editor.selection.start.line;
		let endLine = editor.selection.end.line;

		try {
			let taskSpanMap = new Map();
			let maxTitleLength = 9; // min column length
			let start = undefined;
			let total = 0;
			let notValidCount = 0;
			let commentCount = 0;
			let validCount = 0;
			for (let i = startLine; i < endLine + 1; i++) {
				let line = document.lineAt(i).text;
				if (line.trim().length > 0) {
					let task = Task.tryParseLine(document.lineAt(i).text, start);
					if (task === undefined) {
						notValidCount++;
					} else {
						if (task.text.trim().length === 0 || validCount === 0) {
							if (validCount === 0){
								validCount++;
							} else {
								commentCount++;	
							}
						} else {
							if (taskSpanMap.has(task.text)) {
								(taskSpanMap.get(task.text) as TaskSpan).spanMinutes += task.timeSpanMinutes();
							} else {
								let taskSpan = new TaskSpan(task.text, task.timeSpanMinutes());
								taskSpanMap.set(task.text, taskSpan);
								maxTitleLength = Math.max(maxTitleLength, task.text.length);
							}
							total += task.timeSpanMinutes();
							validCount++;
						}
						start = task.end;
					}
				}
			}
			let taskLines: string[] = [];
			const maxSpanLength = 18;
			taskLines.push(`| ${"Time span".padEnd(maxSpanLength)} | ${"Task".padEnd(maxTitleLength, " ")} |`);
			taskLines.push(`| ${":".padStart(maxSpanLength, "-")} | ${"-".padEnd(maxTitleLength, "-")} | `);

			for (let taskSpan of taskSpanMap.values()) {
				taskLines.push(`| ${("  \`" + taskSpan.spanMinutesToString() + "\`  ").padStart(maxSpanLength)} | ${taskSpan.text.padEnd(maxTitleLength, " ")} |`);
			}

			taskLines.push(`| ${("**\`" + TaskSpan.timeSpanToString(total, getConfiguration('timeSpanFormat'), getConfigurationNumber("timeSpanStep")) + "\`**").padStart(maxSpanLength)} | ${"**Total**".padEnd(maxTitleLength, " ")} |`);

			taskLines.push(_newLine + `> _Last update ${formatHoursAndMinutes(new Date())}_ / Lines [valid:${validCount}, comments:${commentCount}, invalid:${notValidCount}]` + _newLine);

			editBuilder.insert(new vscode.Position(endLine + 1, 0), _newLine + taskLines.join(_newLine));
		} catch (error) {
			vscode.window.showErrorMessage(error.message);
			return Promise.resolve(false);
		}

	}).then((success: any) => {
		if (editor === undefined || document === undefined) { return false; }
		editor.selection = new vscode.Selection(editor.selection.end, editor.selection.end);
	});
}

// ----------------

function getConfigurationRandomString(property: string) {
	const startMessages: string = getConfiguration(property);
	if (startMessages.indexOf("|")) {
		let messages = startMessages.split("|");
		return messages[getRandomInt(0, messages.length)].trim();
	} else {
		return startMessages;
	}
}

function getConfigurationNumber(property: string): number {
	return vscode.workspace.getConfiguration('mytime', null).get(property) as number;
}

function getConfiguration(property: string): string {
	return vscode.workspace.getConfiguration('mytime', null).get(property) as string;
}

function getRandomInt(min: number, max: number) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
}

function formatHoursAndMinutes(date: Date): string {
	return format(date, getConfiguration('timeSpanHoursAndMinutesFormat'));
}

function getHoursAndMinutesSeparator(): string {
	// format expected HH:mm or h:mm or
	let format = getConfiguration('timeSpanHoursAndMinutesFormat');
	if (format.length < 3) { return ":"; }
	if (format.charAt(1).toLocaleLowerCase() !== "h") { return format.charAt(1); }
	if (format.charAt(2).toLocaleLowerCase() !== "h") { return format.charAt(2); }
	return ":";
}

//-----------------

class Task {
	//${getHoursAndMinutesSeparator()}
	private static readonly taskRegEx = `^-\\s+\`(0[0-9]|1[0-9]|2[0-3])${getHoursAndMinutesSeparator()}([0-5][0-9])\`\\s+(.*)$`;

	start: Date;
	end: Date;
	text: String;
	comment: String;

	constructor(text: String, start: Date, end?: Date, comment?: String) {
		this.text = text;
		this.start = start;
		this.end = (end !== undefined) ? end : start;
		this.comment = (comment !== undefined) ? comment : "";
	}

	static isValidLine(line: string): boolean {
		return new RegExp(Task.taskRegEx, "g").test(line);
	}

	static tryParseLine(line: string, start?: Date): Task | undefined {
		try {
			return this.parseLine(line, start);
		} catch {
			return undefined;
		}
	}

	static parseLine(line: string, start?: Date): Task {
		let match = new RegExp(Task.taskRegEx, "g").exec(line);

		if (match === null) {
			throw new Error(`Task line invalid formart: - HH:mm <Task description> (line:${line})`);
		}

		let end = new Date();
		end.setHours(Number.parseInt(match[1]), Number.parseInt(match[2]), 0, 0);
		let text = match[3];
		let comment = "";
		let breakPoint = text.lastIndexOf("\/\/");
		if (breakPoint === 0) {
			text = "";
			comment = text.substring(breakPoint + 2);
		} else if (breakPoint > 0) {
			text = text.substring(0, breakPoint);
			comment = text.substring(breakPoint + 2);
		}

		return new Task(text, start === undefined ? end : start, end, comment);
	}

	timeSpanMinutes(): number {
		let minutes = differenceInMinutes(this.end, this.start);
		if (minutes < 0) {
			minutes = differenceInMinutes(addMinutes(this.end, 60 * 6), addMinutes(this.start, 60 * 6)); // try to move from midnight
		}
		if (minutes <= 0) {
			minutes = 1; // round upper 
		}
		return minutes;
	}

	toLine(): string {
		return `- \`${formatHoursAndMinutes(this.end)}\` ${this.text}`;
	}

	toBreakLine(): string {
		return `- \`${formatHoursAndMinutes(this.end)}\` \/\/_${this.text}_`;
	}

}

class TaskSpan {
	text: String;
	spanMinutes: number;

	constructor(text: String, spanMinutes: number) {
		this.text = text;
		this.spanMinutes = spanMinutes;
	}

	spanMinutesToString(): string {
		return TaskSpan.timeSpanToString(this.spanMinutes, getConfiguration('timeSpanFormat'), getConfigurationNumber("timeSpanStep"));
	}

	static timeSpanToString(spanMinutes: number, format: String, timeSpanStep: number): string {

		let minutes = TaskSpan.timeSpanRound(spanMinutes, timeSpanStep);

		let spanString = "";

		if (format === "hoursAndMinutes" || format === "both") {
			let spanDate: Date = new Date(2020, 1, 1, Math.floor((minutes / 60)), minutes % 60, 0, 0);
			spanString += formatHoursAndMinutes(spanDate);
		}

		if (format === "both") {
			spanString += ' = ';
		}

		if (format === "decimalHours" || format === "both") {
			let decimalHours = Math.round((minutes / 60 + Number.EPSILON) * 100) / 100;
			spanString += `${decimalHours.toFixed(2)}`;
		}

		return spanString;

	}

	private static timeSpanRound(spanMinutes: number, timeSpanStep: number) {
		if (timeSpanStep > 1 && spanMinutes > 0) {
			let module = (spanMinutes % timeSpanStep);
			return spanMinutes - module + (module >= timeSpanStep / 2 ? timeSpanStep : 0);
		}
		return spanMinutes;
	}

}