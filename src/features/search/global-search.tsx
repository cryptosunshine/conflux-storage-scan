import { useRouter } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { type FormEvent, useId, useState } from "react"
import { getAddress, isAddress } from "viem"

const SEQUENCE_PATTERN = /^(?:0|[1-9]\d*)$/
const SEARCH_ERROR = "Enter a non-negative sequence or a 42-character EVM address."

export type SearchDestination = `/submission/${string}` | `/address/${string}`

export interface GlobalSearchProps {
	readonly onNavigate?: (destination: SearchDestination) => void
	readonly compact?: boolean
}

export function resolveSearchDestination(value: string): SearchDestination | undefined {
	const candidate = value.trim()
	if (SEQUENCE_PATTERN.test(candidate)) {
		return `/submission/${BigInt(candidate).toString(10)}`
	}

	const normalizedPrefix = candidate.startsWith("0X") ? `0x${candidate.slice(2)}` : candidate
	if (isAddress(normalizedPrefix)) {
		return `/address/${getAddress(normalizedPrefix)}`
	}

	return undefined
}

export function GlobalSearch({ onNavigate, compact = false }: GlobalSearchProps) {
	const router = useRouter()
	const errorId = useId()
	const [value, setValue] = useState("")
	const [error, setError] = useState<string>()

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const destination = resolveSearchDestination(value)
		if (!destination) {
			setError(SEARCH_ERROR)
			return
		}

		setError(undefined)
		if (onNavigate) {
			onNavigate(destination)
		} else {
			router.history.push(destination)
		}
	}

	return (
		<form
			aria-label="Explorer search"
			className={compact ? "global-search global-search--compact" : "global-search"}
			onSubmit={submit}
		>
			<label className="sr-only" htmlFor={errorId}>
				Search by submission sequence or address
			</label>
			<div className="global-search__control">
				<Search aria-hidden="true" size={17} strokeWidth={2} />
				<input
					aria-describedby={error ? `${errorId}-error` : undefined}
					aria-invalid={Boolean(error)}
					id={errorId}
					onChange={(event) => {
						setValue(event.target.value)
						if (error) setError(undefined)
					}}
					placeholder="Sequence or EVM address"
					type="search"
					value={value}
				/>
				<button type="submit">Search</button>
			</div>
			{error ? (
				<p className="global-search__error" id={`${errorId}-error`} role="alert">
					{error}
				</p>
			) : null}
		</form>
	)
}
