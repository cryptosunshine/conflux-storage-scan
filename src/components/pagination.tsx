import { useTranslation } from "react-i18next"

export interface PaginationProps {
	readonly page: number
	readonly totalPages: number
	readonly buildHref: (page: number) => string
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
	const { t } = useTranslation("common")
	if (totalPages <= 1) {
		return null
	}

	return (
		<nav aria-label={t("pagination.aria")} className="pagination">
			{page > 1 ? (
				<a aria-label={t("pagination.previousPage")} href={buildHref(page - 1)}>
					{t("actions.previous")}
				</a>
			) : (
				<span aria-disabled="true">{t("actions.previous")}</span>
			)}
			<span aria-live="polite">{t("pagination.pageOf", { page, totalPages })}</span>
			{page < totalPages ? (
				<a aria-label={t("pagination.nextPage")} href={buildHref(page + 1)}>
					{t("actions.next")}
				</a>
			) : (
				<span aria-disabled="true">{t("actions.next")}</span>
			)}
		</nav>
	)
}
