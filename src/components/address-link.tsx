import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { Address } from "viem"
import { CopyButton } from "./copy-button"
import { truncateMiddle } from "./format"

export interface AddressLinkProps {
	readonly address: Address
	readonly label?: string
}

export function AddressLink({ address, label }: AddressLinkProps) {
	const { t } = useTranslation("common")
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
			<CopyButton label={label ?? t("table.copySubmitter")} value={address} />
		</span>
	)
}
