/** A pending Promise alone does not keep Node alive. Never report that as success. */
export async function runWithCompletionGuard(operation: () => Promise<void>) {
	let completed = false;
	const beforeExit = () => {
		if (!completed) {
			console.error("error: fatal: Asynchronous CLI work did not complete before Node became idle. Check configuration imports and initialization hooks.");
			process.exitCode = 1;
		}
	};
	process.once("beforeExit", beforeExit);
	try {
		await operation();
	} finally {
		completed = true;
		process.removeListener("beforeExit", beforeExit);
	}
}

/** Drain both queues before explicitly terminating a CLI with application handles. */
export async function flushOutput(
	streams: readonly Pick<NodeJS.WriteStream, "write">[] = [process.stdout, process.stderr],
) {
	await Promise.all(streams.map((stream) => new Promise<void>((resolve) => {
		stream.write("", () => resolve());
	})));
}
