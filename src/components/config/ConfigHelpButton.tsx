import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfigHelpButtonProps {
  title: string;
  content: string;
}

export function ConfigHelpButton({ title, content }: ConfigHelpButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="config-help-button"
        aria-label={`${t("config.help.open")}: ${title}`}
        title={`${t("config.help.open")}: ${title}`}
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={15} aria-hidden="true" />
      </button>

      {open && (
        <div className="help-dialog-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-dialog-header">
              <h2 id={titleId}>{title}</h2>
              <button
                type="button"
                className="help-dialog-close"
                aria-label={t("config.help.close")}
                title={t("config.help.close")}
                ref={closeButtonRef}
                onClick={() => setOpen(false)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <p>{content}</p>
          </div>
        </div>
      )}
    </>
  );
}
