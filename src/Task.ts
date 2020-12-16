import { addDays, addMinutes, differenceInMinutes, format } from 'date-fns';
import { Config } from './config';


//-----------------
export class Task {
	private static readonly taskRegEx = `^-\\s+\`(0[0-9]|1[0-9]|2[0-3])${Config.hoursAndMinutesSeparator}([0-5][0-9])\`\\s+(.*)$`;

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
			comment = text.substring(breakPoint + 2).trim();
			text = "";
		} else if (breakPoint > 0) {
			text = text.substring(0, breakPoint).trim();
			comment = text.substring(breakPoint + 2).trim();
		}
		if (comment.length > 1 && comment.startsWith("_") && comment.endsWith("_")) {
			comment = comment.substring(1,comment.length-1).trim();
		}

		return new Task(text, start === undefined ? end : start, end, comment);
	}

	timeSpanMinutes(): number {
		return Task.timeSpanMinutes(this.end, this.start);
	}

	toLine(): string {
		if (this.text.trim().length > 0) {
			return `- \`${format(this.end, Config.timeSpanHoursAndMinutesFormat)}\` ${this.text}`;
		} else {
			return `- \`${format(this.end, Config.timeSpanHoursAndMinutesFormat)}\` \/\/_${this.comment}_`;
		}
	}

	static timeSpanMinutes(end : Date, start : Date ): number {
		let minutes = differenceInMinutes(end, start);
		if (minutes < 0) {
			minutes = differenceInMinutes(addDays(end, 1), start); // try to move from midnight
		}
		if (minutes <= 0) {
			minutes = 1; // round upper 
		}
		return minutes;

	}
}
