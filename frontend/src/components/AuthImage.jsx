// Loads a protected image with the user's token (an <img src> cannot send headers).
import { useEffect, useState } from "react";
import { api } from "../api";

export default function AuthImage({ src, alt, className }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let objectUrl;
    let alive = true;
    api.blob(src).then((b) => {
      objectUrl = URL.createObjectURL(b);
      if (alive) setUrl(objectUrl);
    }).catch(() => {});
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  if (!url) return <div className={`animate-pulse bg-line ${className}`} />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} className={className} />
    </a>
  );
}
