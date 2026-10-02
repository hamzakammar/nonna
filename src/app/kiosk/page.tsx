// Lane 4 owns the look. Lane 2 owns the ears/mouth hooks it uses.
// Spec: docs/roles/lane-4-shop-window.md § Kiosk
export default function Kiosk() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-8xl">👵</div>
      <h1 className="text-5xl font-bold">Nonna is listening…</h1>
      <p className="text-2xl opacity-70">Say &ldquo;Nonna&rdquo; and ask me anything.</p>
      {/* TODO(lane4): status ring (listening/speaking), current question with giant YES/NO buttons, rush meter */}
    </main>
  );
}
