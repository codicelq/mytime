import * as vscode from 'vscode';
import { Task } from './Task';
import { Config } from './config';
import { addMinutes, format, parse } from 'date-fns';
import { TaskSpan } from './TaskSpan';
import { enUS, it } from 'date-fns/locale';


const _newLine = "\n";

export async function newTaskLine(context: vscode.ExtensionContext, isBreak : boolean) {

	let editor = vscode.window.activeTextEditor;
	let document = vscode.window.activeTextEditor?.document;

	if (editor === undefined || document === undefined) { return; }

    let prevTask = editor.selection.start.line > 0 ? Task.tryParseLine(document.lineAt(editor.selection.start.line - 1).text) : undefined;

    const time = await selectTime(editor, document, (prevTask?.end) ? prevTask.end : new Date() );
    const text = await selectTask(editor, document, isBreak); 

    const newTask = buildTask(prevTask, isBreak, time, text);

    editor.edit((editBuilder) => {
		if (editor === undefined || document === undefined) { return false; }
		try {
			let selection = new vscode.Selection(
				new vscode.Position(editor.selection.start.line, 0),
				editor.selection.end
			);
            editBuilder.replace(selection, newTask.toLine());
		} catch (error) {
			vscode.window.showErrorMessage(error.message);
			return Promise.resolve(false);
		}
	}).then((success: any) => {
		if (editor === undefined || document === undefined) { return false; }
		if (isBreak) {
			var nextLine = editor.selection.end.line;
			var nextCharStart = editor.selection.end.character - text.length - 1;
			var nextCharEnd = editor.selection.end.character - 1;
			if (nextCharStart > 0) {
				editor.selection = new vscode.Selection(new vscode.Position(nextLine, nextCharStart), new vscode.Position(nextLine, nextCharEnd));
			}
		} else {
			var nextLine = editor.selection.end.line;
			var nextChar = editor.selection.end.character - text.length;
			if (nextChar > 0) {
				editor.selection = new vscode.Selection(new vscode.Position(nextLine, nextChar), editor.selection.end);
			}
		}
	});
}

function buildTask(prevTask: Task | undefined, isBreak: boolean, time: Date, text: string) {
    if (prevTask === undefined) {
        return isBreak ? new Task("", time, undefined, text) : new Task(text, time);
    } else {
        return isBreak ? new Task("", prevTask.end, time, text) : new Task(text, prevTask.end, time);
    }
}

async function selectTime(editor: vscode.TextEditor, document: vscode.TextDocument, endTime: Date) {

    let timeSpans: number[] = [15, 30, 45, 60, 90, 120, 240];

    let timeSpanToNow = Task.timeSpanMinutes(new Date(), endTime);
     if (timeSpanToNow > 1) {
        timeSpans.unshift(Task.timeSpanMinutes(new Date(), endTime));
    }

    let timeList: string[] = [];

    for (let i = 0; i < timeSpans.length; i++) {
        let t = addMinutes(endTime, timeSpans[i]);
        timeList.push(`${format(t, Config.timeSpanHoursAndMinutesFormat)} = ${TaskSpan.timeSpanToString(timeSpans[i], "minutesOrHours", 0, false)}`);
    }

    const time = await vscode.window.showQuickPick(timeList, {
        placeHolder: Config.taskTimePlaceholder
    });

    return (!time) ? addMinutes(endTime, 5) : parse(time.substring(0,5), 'HH:mm',new Date());
  
}


async function selectTask(editor: vscode.TextEditor, document: vscode.TextDocument, isBreak : boolean) {

    let startLine = editor.selection.start.line - 50;
    if (startLine < 0) {startLine = 0;};

    let endLine = startLine + 200;
    if (endLine > document.lineCount) {endLine = document.lineCount;};
    
    const taskListMax = 25;
	let taskList : string[] = isBreak ? Config.breakList : Config.taskList;

    for (let i = startLine; i < endLine; i++) {
        let line = document.lineAt(i).text;
        if (line.trim().length > 0) {
            let task = Task.tryParseLine(line, new Date());
            if (task !== undefined) {
				if (!isBreak && task.text.trim().length > 0 
				             && !taskList.includes(task.text.trim())) {
                    taskList.push(task.text.toString().trim());
				} else if (isBreak && task.text.trim().length === 0 
				                   && task.comment.trim().length > 0 
								   && !Config.startMessages.includes(task.comment.trim()) 
								   && !taskList.includes(task.comment.trim())) {
                    taskList.push(task.comment.toString());
                }
            }
        }
        if (taskList.length >= taskListMax) {break;};
    }
    taskList.sort();

    if (taskList.length === 0) {
        return isBreak ? Config.newBreakPlaceholder : Config.newTaskPlaceholder; 
    } else {

		taskList.unshift(isBreak ? Config.newBreakPlaceholder : Config.newTaskPlaceholder );

        let pickItems: vscode.QuickPickItem[] =  taskList.map(label => ({ label }));

        let item = await vscode.window.showQuickPick(pickItems, {
            placeHolder: Config.taskPlaceholder
        });

        return (!item || !item.label) ? Config.taskPlaceholder : item.label;
    }
}

export function summaryBlock() {
	let editor = vscode.window.activeTextEditor;
	let document = vscode.window.activeTextEditor?.document;

	if (editor === undefined || document === undefined) { return; }
	editor.edit((editBuilder) => {
		if (editor === undefined || document === undefined) { return; }
		let startLine = editor.selection.start.line;
		let endLine = editor.selection.end.line;

		try {
			let taskSpanMap = new Map();

			let maxNameLength = 9; // min column length
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
						let taskName = task.text.trim();
						if (taskName.length === 0 || validCount === 0) {
							if (validCount === 0){
								validCount++;
							} else {
								commentCount++;	
							}
						} else {
							if (taskSpanMap.has(taskName)) {
								(taskSpanMap.get(taskName) as TaskSpan).spanMinutes += task.timeSpanMinutes();
							} else {
								let taskSpan = new TaskSpan(taskName, task.timeSpanMinutes());
								taskSpanMap.set(taskName, taskSpan);
								maxNameLength = Math.max(maxNameLength, taskName.length);
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
			taskLines.push(`| ${"Time span".padEnd(maxSpanLength)} | ${"Task".padEnd(maxNameLength, " ")} |`);
			taskLines.push(`| ${":".padStart(maxSpanLength, "-")} | ${"-".padEnd(maxNameLength, "-")} |`);

			const taskSpanMapSorted = new Map([...taskSpanMap.entries()].sort());
			for (let taskSpan of taskSpanMapSorted.values()) {
				taskLines.push(`| ${("  \`" + taskSpan.spanMinutesToString(true) + "\`  ").padStart(maxSpanLength)} | ${taskSpan.text.padEnd(maxNameLength, " ")} |`);
			}

			taskLines.push(`| ${("**\`" + TaskSpan.timeSpanToString(total, Config.timeSpanFormat, Config.timeSpanStep, true) + "\`**").padStart(maxSpanLength)} | ${"**Total**".padEnd(maxNameLength, " ")} |`);
			
			taskLines.push(_newLine + `> _Last update ${format(new Date(), Config.timeSpanHoursAndMinutesFormat)}_ / Lines [valid:${validCount}, comments:${commentCount}, invalid:${notValidCount}]` + _newLine);

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

export function newDayBlock() {
	let editor = vscode.window.activeTextEditor;
	if (editor === undefined) { return; }
	editor.edit((editBuilder) => {
		if (editor === undefined) { return; }

		const locale = { locale: [enUS, it].find(x => { return x.code?.startsWith(Config.newDateLanguage); }) };

		const isEmptyDoc = editor.document.getText(new vscode.Range(new vscode.Position(0,0), new vscode.Position(50,0))).trim().length === 0;
		
		editBuilder.replace(editor.selection, 
			(isEmptyDoc ? "# My Time" + _newLine + _newLine : "")
			+ "## "
			+ format(new Date(), Config.newDateFormat, locale)
			+ _newLine
			+ _newLine
			+ new Task("", new Date(), undefined, Config.startMessage).toLine()
			+ _newLine);

	}).then((success: any) => {
		if (editor === undefined) { return; }
		var cursorEndPosition = editor.selection.end;
		editor.selection = new vscode.Selection(cursorEndPosition, cursorEndPosition);
	});
} 