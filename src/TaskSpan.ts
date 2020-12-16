import { Config } from './config';
import { format } from 'date-fns';

export class TaskSpan {
	text: String;
	spanMinutes: number;

	constructor(text: String, spanMinutes: number) {
		this.text = text;
		this.spanMinutes = spanMinutes;
	}

	spanMinutesToString(fixedDecimal: boolean): string {
		return TaskSpan.timeSpanToString(this.spanMinutes, Config.timeSpanFormat, Config.timeSpanStep, fixedDecimal);
	}

	static timeSpanToString(spanMinutes: number, timeFormat: String, timeSpanStep: number, fixedDecimal: boolean): string {

		let minutes = TaskSpan.timeSpanRound(spanMinutes, timeSpanStep);

		let spanString = "";

		if (timeFormat === "hoursAndMinutes") {
			let spanDate: Date = new Date(2020, 1, 1, Math.floor((minutes / 60)), minutes % 60, 0, 0);
			spanString = format(spanDate, Config.timeSpanHoursAndMinutesFormat);
		} else if (timeFormat === "minutesOrHours" && minutes < 60) { 
			spanString = `${spanMinutes} m`;
		} else { // hours is default
			let decimalHours = Math.round((minutes / 60 + Number.EPSILON) * 100) / 100;
			if (fixedDecimal) {
				spanString = `${decimalHours.toFixed(2) } h`;
			} else {
				spanString = `${decimalHours} h`;
			}
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
