import React from "react";

export default function SearchResult({ result }: any) {
  return (
    <div className="rounded-md border border-[#ffffff12] bg-[#111f2d] p-2">
      <div
        className="text-xs font-semibold truncate"
        style={{
          color: "var(--accent-color-dynamic)",
        }}
      >
        {result.title || "Result"}
      </div>
      <p className="text-xs text-gray-300 mt-1 line-clamp-3">
        {result.snippet || "No snippet"}
      </p>
      {result.url && (
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[var(--accent-color-dynamic)] mt-1 inline-block"
        >
          Open source
        </a>
      )}
    </div>
  );
}
