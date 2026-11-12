'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="public-state"><h1>We couldn’t load this page.</h1><p role="alert">Please try again. If you were checking a payment, use your private order link before trying another payment.</p><nav aria-label="Page recovery"><button onClick={reset}>Try again</button><a href="/">PUNA home</a></nav></main>}
