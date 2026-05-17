import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface NoticeListProps {
  supported: boolean;
}

export function NoticeList({ supported }: NoticeListProps) {
  const { t } = useTranslation();

  return (
    <>
      {!supported && (
        <div className="notice warning">
          <AlertCircle size={18} />
          <span>{t("notice.webHidUnsupported")}</span>
        </div>
      )}
    </>
  );
}
