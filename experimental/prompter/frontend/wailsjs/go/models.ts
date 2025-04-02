export namespace main {
	
	export class CommandOutput {
	    stdout: string;
	    stderr: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new CommandOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.stdout = source["stdout"];
	        this.stderr = source["stderr"];
	        this.error = source["error"];
	    }
	}

}

