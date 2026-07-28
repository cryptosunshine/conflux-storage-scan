import { Check, Copy } from "lucide-react"
import { useState } from "react"

export interface CopyButtonProps {
	readonly value: string
	readonly label: string
}

export function CopyButton({ value, label }: CopyButtonProps) {
	const [copied, setCopied] = useState(false)

	async function copyValue(): Promise<void> {
		await navigator.clipboard.writeText(value)
		setCopied(true)
	}

	return (
		<button
			aria-label={copied ? `${label}, copied` : label}
			className="icon-button"
			onClick={copyValue}
			title={copied ? "Copied" : label}
			type="button"
		>
			{copied ? (
				<Check aria-hidden="true" size={15} strokeWidth={2} />
			) : (
				<Copy aria-hidden="true" size={15} strokeWidth={2} />
			)}
		</button>
	)
}
