import React from "react";

function PageHeader({ title, subtitle, action, children, className = "" }: any) {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 ${className}`}
    >
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {action}
        {children}
      </div>
    </div>
  );
}

export default PageHeader;
