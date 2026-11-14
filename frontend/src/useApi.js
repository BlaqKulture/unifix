// Load data from the API with loading / error state and a reload function.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!path) return Promise.resolve();
    setLoading(true);
    return api.get(path)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
