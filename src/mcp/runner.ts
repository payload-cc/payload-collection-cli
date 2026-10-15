import { spawn, type ChildProcess } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";

export interface CLIResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
	signal: string | null;
	error?: string;
}
export interface Runner {
	run(args: string[], signal?: AbortSignal): Promise<CLIResult>;
}
export interface RunnerOptions {
	projectRoot: string;
	cliPath: string;
	timeoutMs?: number;
	maxOutputBytes?: number;
}

/** Fixed, owner-selected project; argv only, never a shell. No write retries. */
export class CLIRunner implements Runner {
	readonly projectRoot: string;
	private readonly children = new Set<ChildProcess>();
	private closed = false;
	private readonly timeoutMs: number;
	private readonly maxOutputBytes: number;
	constructor(private readonly options: RunnerOptions) {
		if (
			!path.isAbsolute(options.projectRoot) ||
			!path.isAbsolute(options.cliPath)
		)
			throw new Error("projectRoot and cliPath must be absolute paths.");
		this.projectRoot = realpathSync(options.projectRoot);
		if (!statSync(this.projectRoot).isDirectory())
			throw new Error("projectRoot must be a directory.");
		this.timeoutMs = options.timeoutMs ?? 300000;
		this.maxOutputBytes = options.maxOutputBytes ?? 8 * 1024 * 1024;
		if (
			!Number.isSafeInteger(this.timeoutMs) ||
			this.timeoutMs < 1 ||
			this.timeoutMs > 3600000
		)
			throw new Error("timeoutMs must be 1..3600000.");
		if (!Number.isSafeInteger(this.maxOutputBytes) || this.maxOutputBytes < 1)
			throw new Error("maxOutputBytes must be positive.");
	}
	private kill(child: ChildProcess, signal: NodeJS.Signals) {
		if (!child.pid) return;
		try {
			if (process.platform === "win32") child.kill(signal);
			else process.kill(-child.pid, signal);
		} catch {
			/* Process may already have exited. */
		}
	}
	close() {
		this.closed = true;
		for (const child of this.children) this.kill(child, "SIGKILL");
	}
	async run(args: string[], signal?: AbortSignal): Promise<CLIResult> {
		if (this.closed || signal?.aborted)
			return {
				stdout: "",
				stderr: "",
				exitCode: null,
				signal: null,
				error: "Operation cancelled or server closed.",
			};
		return new Promise((resolve) => {
			const child = spawn(process.execPath, [this.options.cliPath, ...args], {
				cwd: this.projectRoot,
				shell: false,
				detached: process.platform !== "win32",
				stdio: ["ignore", "pipe", "pipe"],
			});
			this.children.add(child);
			const stdout: Buffer[] = [],
				stderr: Buffer[] = [];
			let size = 0,
				error: string | undefined,
				killTimer: ReturnType<typeof setTimeout> | undefined;
			const stop = (reason: string) => {
				if (error) return;
				error = reason;
				this.kill(child, "SIGTERM");
				killTimer = setTimeout(() => this.kill(child, "SIGKILL"), 1000);
				killTimer.unref();
			};
			const collect = (chunks: Buffer[]) => (chunk: Buffer) => {
				const remaining = Math.max(0, this.maxOutputBytes - size);
				if (remaining) chunks.push(chunk.subarray(0, remaining));
				size += chunk.length;
				if (size > this.maxOutputBytes) stop("CLI output limit exceeded.");
			};
			child.stdout.on("data", collect(stdout));
			child.stderr.on("data", collect(stderr));
			child.on("error", (cause) => {
				error = cause.message;
			});
			const timer = setTimeout(
				() => stop(`CLI timed out after ${this.timeoutMs} ms.`),
				this.timeoutMs,
			);
			const abort = () => stop("CLI operation cancelled.");
			signal?.addEventListener("abort", abort, { once: true });
			if (signal?.aborted) abort();
			child.on("close", (exitCode, signalName) => {
				// Terminate any remaining descendants in our POSIX process group too.
				if (process.platform !== "win32") this.kill(child, "SIGKILL");
				clearTimeout(timer);
				if (killTimer) clearTimeout(killTimer);
				signal?.removeEventListener("abort", abort);
				this.children.delete(child);
				resolve({
					stdout: Buffer.concat(stdout).toString("utf8"),
					stderr: Buffer.concat(stderr).toString("utf8"),
					exitCode,
					signal: signalName,
					...(error ? { error } : {}),
				});
			});
		});
	}
}
