import * as readline from "readline";
// One long-lived readline interface, reused across many questions in a
// single command run. Recreating an interface per-question (open, ask,
// close, repeat) is what caused a real crash in tf.import.ts: closing the
// interface can momentarily leave Node's event loop with zero open handles
// mid-loop, racing against the outer top-level `await route(args)` in
// index.ts and triggering an "unsettled top-level await" forced exit.
// Commands that ask more than one question MUST use createPrompter(),
// not the single-shot prompt() below.
export function createPrompter() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const ask = (question) => new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
    return { ask, close: () => rl.close() };
}
// Single-question convenience wrapper — safe ONLY for commands that prompt
// exactly once (or a small fixed number of times outside a loop). Anything
// that loops over a resource list (tf.import) must use createPrompter().
export function prompt(question) {
    const { ask, close } = createPrompter();
    return ask(question).then((answer) => {
        close();
        return answer;
    });
}
