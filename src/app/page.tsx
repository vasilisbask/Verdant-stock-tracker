export default function Home() {
  return (
    <main className="min-h-screen bg-[#091413] text-[#E2F5ED] flex items-center justify-center px-6">
      <section className="max-w-3xl text-center">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-[#B0E4CC]">
          Verdant Terminal
        </p>

        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Portfolio Tracker & Stock Screener
        </h1>

        <p className="mt-6 text-lg text-[#9FCDBA]">
          Secure portfolio tracking, transaction ledgers, watchlists and
          quantitative stock screening for modern investors.
        </p>

        <div className="mt-10 flex justify-center gap-4">
          <a
            href="/login"
            className="rounded-lg bg-[#B0E4CC] px-5 py-3 font-semibold text-[#091413] transition hover:bg-[#B0E4CC]/90"
          >
            Launch App
          </a>

          <a
            href="/register"
            className="rounded-lg border border-[#285A48] px-5 py-3 font-semibold text-[#E2F5ED] transition hover:bg-[#285A48]/30"
          >
            Create Account
          </a>
        </div>
      </section>
    </main>
  );
}