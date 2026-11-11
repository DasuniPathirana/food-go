export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-icon">
        <svg
          viewBox="0 0 36 42"
          width="27"
          height="32"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M18 1C8.6 1 1 8.5 1 17.8 1 30.1 18 41 18 41s17-10.9 17-23.2C35 8.5 27.4 1 18 1Z"
            fill="currentColor"
          />
          <path
            d="M12 9v7c0 2 1.3 3.2 3 3.2S18 18 18 16V9m-3 0v22m9-22v22m0-22c-3 3-4 7-4 11h4"
            stroke="#fffdf6"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        food<span className="brand-go">go</span>
        <span className="brand-dot">.</span>
      </span>
    </span>
  );
}
