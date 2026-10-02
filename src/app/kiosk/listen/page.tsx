// Lane 2's voice screen (NonnaListener), moved here from /kiosk when Lane 4's home screen took /kiosk.
import { NonnaListener } from "@/lib/voice/client/NonnaListener";

export default function Listen() {
  return <NonnaListener />;
}
