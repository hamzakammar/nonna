import Link from "next/link";

const SURFACES = [
  { href: "/kiosk", title: "Kiosk", who: "Grandma", note: "The tablet in the bakery. Voice first, giant type, almost no buttons." },
  { href: "/dashboard", title: "Dashboard", who: "The grandson", note: "Inventory, reorders, sales, busyness, Gentle Truths." },
  { href: "/pos", title: "Mock till", who: "Staff / demo", note: "Tap products to record sales (stands in for the Verifone)." },
  { href: "/demo", title: "Demo control", who: "Presenter", note: "Time travel, simulate a rush, reset the world." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-4xl font-bold">Nonna.exe 👵</h1>
      <p className="mt-2 text-lg opacity-80">The back office that lives in Grandma&apos;s bakery so she doesn&apos;t have to.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {SURFACES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block rounded-2xl border p-5 hover:bg-black/5 dark:hover:bg-white/5">
              <div className="text-xl font-semibold">{s.title}</div>
              <div className="text-sm opacity-60">for {s.who}</div>
              <p className="mt-2 text-sm">{s.note}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
