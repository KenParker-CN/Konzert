"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface MarqueeTextProps {
  children: ReactNode;
  className?: string;
  title?: string;
  as?: "div" | "h1" | "p";
}

export function MarqueeText({
  children,
  className = "",
  title,
  as = "div",
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const updateOverflow = () => {
      setOverflowing(content.scrollWidth > container.clientWidth + 1);
    };
    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children]);

  const Component = as;
  return (
    <Component
      ref={containerRef}
      className={`min-w-0 overflow-hidden ${className}`}
      title={title}
    >
      <span
        ref={contentRef}
        className={`inline-flex min-w-max ${
          overflowing ? "konzert-marquee" : "max-w-full truncate"
        }`}
      >
        <span>{children}</span>
        {overflowing ? (
          <span aria-hidden className="pl-12">
            {children}
          </span>
        ) : null}
      </span>
    </Component>
  );
}
