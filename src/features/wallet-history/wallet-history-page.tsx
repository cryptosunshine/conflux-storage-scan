import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import type { Address } from "viem"
import { useAccount, useSwitchChain } from "wagmi"
import { useStorageDataSource } from "../../app/providers"
import { CopyButton } from "../../components/copy-button"
import { formatBytes, formatInteger, truncateMiddle } from "../../components/format"
import { MetricCard } from "../../components/metric-card"
import { Pagination } from "../../components/pagination"
import { SubmissionTable } from "../../components/submission-table"
import { createStorageQueries, keepPreviousAddressPage, storageKeys } from "../../data/queries"
import { RecoveryDataState } from "../recovery/recovery-data-state"
import { useStorageSync } from "../storage/use-storage-sync"

export interface WalletHistoryContentProps {
	readonly page: number
	readonly address?: Address
	readonly chainId?: number
	readonly onSwitchChain?: () => void
}

function DisconnectedHistory() {
	const { t } = useTranslation("wallet")
	return (
		<section aria-labelledby="history-title" className="wallet-empty">
			<p className="eyebrow">{t("disconnectedEyebrow")}</p>
			<h1 id="history-title">{t("disconnectedTitle")}</h1>
			<p>{t("disconnectedDescription")}</p>
			<div className="wallet-empty__action">
				<ConnectButton showBalance={false} />
			</div>
			<small>{t("disconnectedNote")}</small>
		</section>
	)
}

function ConnectedHistory({
	address,
	chainId,
	onSwitchChain,
	page,
}: Required<Pick<WalletHistoryContentProps, "address" | "page">> &
	Pick<WalletHistoryContentProps, "chainId" | "onSwitchChain">) {
	const dataSource = useStorageDataSource()
	const { i18n, t } = useTranslation("wallet")
	const locale = i18n.resolvedLanguage ?? i18n.language
	const queryClient = useQueryClient()
	const previousAddress = useRef<Address | undefined>(undefined)
	const queries = createStorageQueries(dataSource)
	const summary = useQuery(queries.addressSummary(address))
	const submissions = useQuery({
		...queries.address(address, page),
		placeholderData: (previousData, previousQuery) => keepPreviousAddressPage(address, previousData, previousQuery),
	})
	const sync = useStorageSync([address])
	const syncState = sync.data ?? dataSource.getSyncState()
	const wrongNetwork = chainId !== undefined && chainId !== 71

	useEffect(() => {
		const previous = previousAddress.current
		previousAddress.current = address
		if (previous && previous.toLowerCase() !== address.toLowerCase()) {
			void queryClient.cancelQueries({
				queryKey: storageKeys.addressRoot(),
				predicate: (query) => query.queryKey[2] === previous.toLowerCase(),
			})
		}
	}, [address, queryClient])

	return (
		<section aria-labelledby="history-title" className="page-section">
			<header className="page-heading page-heading--address">
				<div>
					<p className="eyebrow">{t("connectedAccount")}</p>
					<h1 id="history-title">{t("disconnectedTitle")}</h1>
					<div className="full-address">
						<code title={address}>{truncateMiddle(address, 12, 10)}</code>
						<CopyButton label={t("copyAccount")} value={address} />
					</div>
				</div>
			</header>

			{wrongNetwork ? (
				<div className="network-warning" role="status">
					<div>
						<strong>{t("wrongNetwork", { chainId })}</strong>
						<p>{t("switchDescription")}</p>
					</div>
					{onSwitchChain ? (
						<button className="secondary-button" onClick={onSwitchChain} type="button">
							{t("switchNetwork")}
						</button>
					) : null}
				</div>
			) : null}

			<RecoveryDataState onRetry={() => void sync.refetch()} state={syncState} />

			{summary.data ? (
				<div className="address-metrics">
					<MetricCard
						label={t("indexedSubmissions")}
						value={formatInteger(summary.data.indexedSubmissionCount, locale)}
					/>
					<MetricCard label={t("indexedLogicalData")} value={formatBytes(summary.data.indexedLogicalBytes, locale)} />
				</div>
			) : null}

			<section aria-labelledby="wallet-submissions-title" className="content-panel">
				<header className="section-heading">
					<div>
						<p className="eyebrow">{t("publicIndex")}</p>
						<h2 id="wallet-submissions-title">{t("accountActivity")}</h2>
					</div>
					{submissions.data ? <p>{t("eventCount", { count: submissions.data.totalItems })}</p> : null}
				</header>
				{submissions.data ? (
					submissions.data.items.length > 0 ? (
						<>
							<SubmissionTable caption={t("myCaption")} submissions={submissions.data.items} />
							<Pagination
								buildHref={(targetPage) => `/history?page=${targetPage}`}
								page={submissions.data.page}
								totalPages={submissions.data.totalPages}
							/>
						</>
					) : (
						<div className="empty-state">
							<h3>{t("emptyTitle")}</h3>
							<p>{t("emptyDescription")}</p>
						</div>
					)
				) : (
					<div aria-label={t("loading")} className="table-loading skeleton" role="status" />
				)}
			</section>
		</section>
	)
}

export function WalletHistoryContent({ address, chainId, onSwitchChain, page }: WalletHistoryContentProps) {
	if (!address) {
		return <DisconnectedHistory />
	}
	return <ConnectedHistory address={address} chainId={chainId} onSwitchChain={onSwitchChain} page={page} />
}

export function WalletHistoryPage({ page }: { readonly page: number }) {
	const account = useAccount()
	const { switchChain } = useSwitchChain()

	return (
		<WalletHistoryContent
			address={account.isConnected ? account.address : undefined}
			chainId={account.isConnected ? account.chainId : undefined}
			onSwitchChain={() => switchChain({ chainId: 71 })}
			page={page}
		/>
	)
}
