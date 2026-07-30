import { RefreshCw, Server } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { StorageNodeHealth } from "../../storage/node/node-pool"

export interface NodeHealthPanelProps {
	readonly checking: boolean
	readonly health?: readonly StorageNodeHealth[]
	readonly onCheck: () => void
}

function nodeLabel(url: string): string {
	try {
		return new URL(url).host || url
	} catch {
		return url
	}
}

export function NodeHealthPanel({ checking, health, onCheck }: NodeHealthPanelProps) {
	const { t } = useTranslation("storagePoc")
	return (
		<section aria-labelledby="storage-node-health-title" className="storage-poc__node-section">
			<header className="storage-poc__section-heading">
				<div>
					<p className="eyebrow">Storage Node JSON-RPC</p>
					<h2 id="storage-node-health-title">{t("nodes.title")}</h2>
					<p>{t("nodes.description")}</p>
				</div>
				<button className="secondary-button" disabled={checking} onClick={onCheck} type="button">
					<RefreshCw aria-hidden="true" size={15} />
					{t("nodes.action")}
				</button>
			</header>
			<div aria-live="polite" className="storage-poc__node-list" role="status">
				{checking && !health ? <p className="storage-poc__muted">{t("nodes.checking")}</p> : null}
				{health?.map((node) => (
					<div className="storage-node-row" key={node.client.url}>
						<span
							aria-hidden="true"
							className={`storage-node-row__icon ${
								node.healthy ? "storage-node-row__icon--healthy" : "storage-node-row__icon--unhealthy"
							}`}
						>
							<Server size={16} />
						</span>
						<div>
							<strong>{nodeLabel(node.client.url)}</strong>
							<code translate="no">{node.client.url}</code>
						</div>
						<div className="storage-node-row__status">
							<strong>
								{node.healthy
									? t("nodes.healthy")
									: t("nodes.unhealthy", {
											reason: node.reason ?? "unknown",
										})}
							</strong>
							{node.status ? (
								<span>
									{t("nodes.peers", {
										count: node.status.connectedPeers,
									})}
									{" · "}
									{t("nodes.lag", {
										count: node.blockLag?.toString() ?? "—",
									})}
								</span>
							) : null}
						</div>
					</div>
				))}
				{!checking && !health ? <p className="storage-poc__muted">{t("nodes.notChecked")}</p> : null}
			</div>
		</section>
	)
}
