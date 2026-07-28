import { Link } from "@tanstack/react-router"
import type { Address } from "viem"
import { CopyButton } from "./copy-button"
import { truncateMiddle } from "./format"

export interface AddressLinkProps {
	readonly address: Address
	readonly label?: string
}

export function AddressLink({ address, label = "submitter address" }: AddressLinkProps) {
	return (
		<span className="hash-value">
			<Link
				className="hash-value__link"
				params={{ address }}
				search={{ page: 1 }}
				title={address}
				to="/address/$address"
			>
				{truncateMiddle(address)}
			</Link>
			<CopyButton label={`Copy ${label}`} value={address} />
		</span>
	)
}
