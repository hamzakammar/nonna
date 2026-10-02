// Lane 4 (UI) + Lane 3 (POST /api/sales). Stands in for Grandma's standalone Verifone.
export default function Pos() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Till</h1>
      {/* TODO(lane4): product tiles from DB → cart → Card / Cash buttons → POST /api/sales */}
    </main>
  );
}
