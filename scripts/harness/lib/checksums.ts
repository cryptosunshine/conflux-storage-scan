import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

export function sha256Text(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex")
}

export async function sha256File(path: string): Promise<string> {
	return createHash("sha256")
		.update(await readFile(path))
		.digest("hex")
}

export function stringifyFixtureJson(value: unknown): string {
	return `${JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString(10) : item), 2)}\n`
}
