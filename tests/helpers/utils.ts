export function removeDebuggerInfo(input: string): string {
    let val = input.slice(input.indexOf('\n{') + 1);
    val = val.slice(0, val.lastIndexOf('}\n') + 2);

    return val;
}
