/**
 * 应用品牌图标（黑胶唱片造型）。
 * 与 src-tauri/icons 下的桌面图标、app/favicon.ico 使用同一设计：
 * 黑色方框内一张蓝色唱片，唱针指向右上方。
 * 黑色线条使用 currentColor，可随所在容器的文字颜色自适应。
 */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.104"
      />
      <circle
        cx="24"
        cy="25"
        r="11"
        fill="#1967d2"
        stroke="currentColor"
        strokeWidth="1.104"
      />
      <rect x="22" y="23" width="4" height="4" rx="2" fill="white" />
      <rect x="34" y="34" width="4" height="4" rx="2" fill="currentColor" />
      <path
        d="M28 20 36 12"
        stroke="currentColor"
        strokeWidth="1.104"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
