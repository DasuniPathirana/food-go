"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state page-empty" role="alert">
      <h1>Let’s try that again.</h1>
      <p>
        Something interrupted this page. Your account details have not been
        displayed.
      </p>
      <button className="primary-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
