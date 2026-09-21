"use client";

import * as React from "react";
import {motion, type Transition} from "motion/react";

interface ImageZoomProps extends React.ComponentProps<"div"> {
    children: React.ReactElement;
    zoomScale?: number;
    transition?: Transition;
    zoomOnClick?: boolean;
    zoomOnHover?: boolean;
    disabled?: boolean;
}

export function ImageZoom({
    children,
    zoomScale = 3,
    transition = {type: "spring", stiffness: 200, damping: 28},
    zoomOnClick = true,
    zoomOnHover = true,
    disabled = false,
    style,
    ...props
}: ImageZoomProps) {
    const [isZoomed, setIsZoomed] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const isTouch = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;

    const setOriginFromEvent = React.useCallback(
        (event: React.MouseEvent | React.TouchEvent) => {
            const container = containerRef.current;
            const child = container?.firstElementChild as HTMLElement | null;
            if (!container || !child) return;
            const rect = container.getBoundingClientRect();
            const point = "touches" in event ? event.touches[0] : event;
            if (!point) return;
            const x = Math.max(0, Math.min(rect.width, point.clientX - rect.left));
            const y = Math.max(0, Math.min(rect.height, point.clientY - rect.top));
            child.style.transformOrigin = `${x}px ${y}px`;
        },
        [],
    );

    return (
        <div
            ref={containerRef}
            {...props}
            style={{
                position: "relative",
                overflow: "hidden",
                cursor: disabled ? "default" : isZoomed ? "zoom-out" : "zoom-in",
                touchAction: "manipulation",
                ...style,
            }}
            onMouseEnter={() => {
                if (!disabled && !isTouch && zoomOnHover) setIsZoomed(true);
            }}
            onMouseLeave={() => {
                if (!disabled && !isTouch && zoomOnHover) setIsZoomed(false);
            }}
            onMouseMove={(event) => {
                if (!disabled && !isTouch) setOriginFromEvent(event);
            }}
            onClick={(event) => {
                if (!disabled && zoomOnClick) {
                    setOriginFromEvent(event);
                    setIsZoomed((value) => !value);
                }
            }}
            onTouchStart={(event) => {
                if (disabled) return;
                setOriginFromEvent(event);
                setIsZoomed((value) => (zoomOnClick ? !value : true));
            }}
            onTouchMove={(event) => {
                if (!disabled) setOriginFromEvent(event);
            }}
            onTouchEnd={() => {
                if (!disabled && !zoomOnClick) setIsZoomed(false);
            }}
        >
            <motion.div
                animate={{scale: disabled || !isZoomed ? 1 : zoomScale}}
                transition={transition}
                className="flex size-full items-center justify-center"
                style={{willChange: "transform"}}
            >
                {children}
            </motion.div>
        </div>
    );
}
