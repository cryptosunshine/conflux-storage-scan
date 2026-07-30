import { CheckCircle2, X } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

export interface StorageToastProps {
	readonly message?: string
	readonly onDismiss: () => void
}

export function StorageToast({ message, onDismiss }: StorageToastProps) {
	const { t } = useTranslation("storagePoc")

	useEffect(() => {
		if (!message) {
			return
		}
		const timer = window.setTimeout(onDismiss, 5_000)
		return () => window.clearTimeout(timer)
	}, [message, onDismiss])

	if (!message) {
		return null
	}

	return (
		<div aria-live="polite" className="storage-toast" role="status">
			<CheckCircle2 aria-hidden="true" size={18} />
			<span>{message}</span>
			<button aria-label={t("toast.dismiss")} className="storage-toast__dismiss" onClick={onDismiss} type="button">
				<X aria-hidden="true" size={16} />
			</button>
		</div>
	)
}
