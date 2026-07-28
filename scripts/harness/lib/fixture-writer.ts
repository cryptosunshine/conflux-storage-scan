import { randomUUID } from "node:crypto"
import { access, mkdir, open, readdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, normalize, sep } from "node:path"

export type FixtureWriterErrorCode = "FIXTURE_EXISTS" | "FIXTURE_LOCKED" | "INVALID_FIXTURE_PATH"

export class FixtureWriterError extends Error {
	readonly code: FixtureWriterErrorCode

	constructor(code: FixtureWriterErrorCode, message: string) {
		super(message)
		this.name = "FixtureWriterError"
		this.code = code
	}
}

export type FixtureFileValue = string | unknown
export type FixtureFiles = Readonly<Record<string, FixtureFileValue>>
export type FixtureValidator = (temporaryDirectory: string) => Promise<void>

async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path)
		return true
	} catch {
		return false
	}
}

function assertVersion(version: string): void {
	if (!/^v[1-9]\d*$/.test(version)) {
		throw new FixtureWriterError("INVALID_FIXTURE_PATH", `Invalid fixture version: ${version}`)
	}
}

function resolveFixtureFile(root: string, relativePath: string): string {
	const normalizedPath = normalize(relativePath)
	if (!relativePath || isAbsolute(relativePath) || normalizedPath === ".." || normalizedPath.startsWith(`..${sep}`)) {
		throw new FixtureWriterError("INVALID_FIXTURE_PATH", `Fixture path must stay inside its version: ${relativePath}`)
	}
	return join(root, normalizedPath)
}

function serializeFixtureValue(value: FixtureFileValue): string {
	if (typeof value === "string") {
		return value
	}

	return `${JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString(10) : item), 2)}\n`
}

export async function nextFixtureVersion(root: string): Promise<`v${number}`> {
	await mkdir(root, { recursive: true })
	const entries = await readdir(root, { withFileTypes: true })
	const latestVersion = entries.reduce((latest, entry) => {
		const match = entry.isDirectory() ? /^v([1-9]\d*)$/.exec(entry.name) : null
		return match ? Math.max(latest, Number(match[1])) : latest
	}, 0)
	return `v${latestVersion + 1}`
}

export async function publishFixture(
	root: string,
	version: `v${number}`,
	files: FixtureFiles,
	validate?: FixtureValidator,
): Promise<string> {
	assertVersion(version)
	await mkdir(root, { recursive: true })

	const targetDirectory = join(root, version)
	if (await pathExists(targetDirectory)) {
		throw new FixtureWriterError("FIXTURE_EXISTS", `${version} is already accepted and cannot be overwritten`)
	}

	const lockPath = join(root, `.${version}.lock`)
	let lock: Awaited<ReturnType<typeof open>> | undefined
	try {
		lock = await open(lockPath, "wx")
	} catch {
		throw new FixtureWriterError("FIXTURE_LOCKED", `${version} is being published by another process`)
	}

	const temporaryDirectory = join(root, `.${version}.tmp-${process.pid}-${randomUUID()}`)
	try {
		if (await pathExists(targetDirectory)) {
			throw new FixtureWriterError("FIXTURE_EXISTS", `${version} is already accepted and cannot be overwritten`)
		}

		await mkdir(temporaryDirectory)
		for (const [relativePath, value] of Object.entries(files)) {
			const targetFile = resolveFixtureFile(temporaryDirectory, relativePath)
			await mkdir(dirname(targetFile), { recursive: true })
			await writeFile(targetFile, serializeFixtureValue(value), "utf8")
		}

		await validate?.(temporaryDirectory)
		await rename(temporaryDirectory, targetDirectory)
		return targetDirectory
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true })
		await lock.close()
		await rm(lockPath, { force: true })
	}
}
