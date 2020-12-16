import * as vscode from 'vscode';

export class Config {

	static get newBreakPlaceholder() : string {
        return Config.getRandomString("newBreakPlaceholder");
    }

	static get newTaskPlaceholder() : string {
        return Config.getRandomString("newTaskPlaceholder");
    }

    static get startMessage() : string {
        return Config.getRandomString("startMessage");
    }

    static get startMessages() : string[] {
        return Config.getString("startMessage").split('|').filter(x => x);
    }

    static get taskPlaceholder() : string {
        return Config.getRandomString("taskPlaceholder");        
    }

    static get taskTimePlaceholder() : string {
        return Config.getRandomString("taskTimePlaceholder");        
    }

    static get taskList() : string[] {
        return Config.getString("taskList").split("|").filter(x => x);        
    }

    static get breakList() : string[] {
        return Config.getString("breakList").split("|").filter(x => x);        
    }

    static get newDateFormat() : string {
        return Config.getString("newDateFormat");        
    }

    static get newDateLanguage() : string  {
        return Config.getString("newDateLanguage");        
    }

    static get timeSpanFormat() : string {
        return Config.getString("timeSpanFormat");   
    }

    static get timeSpanHoursAndMinutesFormat() : string {
        return Config.getString("timeSpanHoursAndMinutesFormat");
    }

    static get timeSpanStep() : number {
        return Config.getNumber("timeSpanStep");
    }

    static get hoursAndMinutesSeparator(): string {
        // format expected HH:mm or h:mm or
        let format = Config.timeSpanHoursAndMinutesFormat;
        if (format.length < 3) { return ":"; }
        if (format.charAt(1).toLocaleLowerCase() !== "h") { return format.charAt(1); }
        if (format.charAt(2).toLocaleLowerCase() !== "h") { return format.charAt(2); }
        return ":";
    }

 

    private static getRandomString(property: string) {
        const value: string = Config.getString(property);
        if (value.indexOf("|")) {
            let messages = value.split("|");
            return messages[Config.getRandomInt(0, messages.length)].trim();
        } else {
            return value;
        }
    }
    
    private static getNumber(property: string): number {
        return vscode.workspace.getConfiguration('mytime', null).get(property) as number;
    }
    
    private static getString(property: string): string {
        return vscode.workspace.getConfiguration('mytime', null).get(property) as string;
    }
    
    private static getRandomInt(min: number, max: number) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
    }
    
}