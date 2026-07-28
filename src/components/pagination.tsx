export interface PaginationProps {
	readonly page: number
	readonly totalPages: number
	readonly buildHref: (page: number) => string
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
	if (totalPages <= 1) {
		return null
	}

	return (
		<nav aria-label="Pagination" className="pagination">
			{page > 1 ? (
				<a aria-label="Previous page" href={buildHref(page - 1)}>
					Previous
				</a>
			) : (
				<span aria-disabled="true">Previous</span>
			)}
			<span aria-live="polite">
				Page {page} of {totalPages}
			</span>
			{page < totalPages ? (
				<a aria-label="Next page" href={buildHref(page + 1)}>
					Next
				</a>
			) : (
				<span aria-disabled="true">Next</span>
			)}
		</nav>
	)
}
