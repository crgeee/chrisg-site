import { useEffect } from "react";

const BASE_TITLE = "Christopher R. Gonzalez";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — Staff Software Engineer`;
  }, [title]);
}
