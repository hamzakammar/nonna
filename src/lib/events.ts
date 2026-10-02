/**
 * Typed in-process event bus. This is how lanes talk to each other without
 * importing each other's internals.
 *
 *   bus.emit("stock.low", { ingredientId, totalQty });   // inventory lane
 *   bus.on("stock.low", ({ ingredientId }) => ...);      // notify lane
 *
 * Event names and payloads are defined in `EventMap` in ./types.ts.
 * It's a singleton on globalThis so Next's dev hot-reload doesn't create duplicates.
 */
import { EventEmitter } from "node:events";
import type { EventMap } from "./types";

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void | Promise<void>;

class Bus {
  private ee = new EventEmitter();
  constructor() {
    this.ee.setMaxListeners(100);
  }
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.ee.emit(event, payload);
  }
  on<K extends keyof EventMap>(event: K, handler: Handler<K>): () => void {
    const wrapped = (p: EventMap[K]) => {
      Promise.resolve(handler(p)).catch((err) => console.error(`[bus] ${String(event)} handler failed`, err));
    };
    this.ee.on(event, wrapped);
    return () => this.ee.off(event, wrapped);
  }
}

const g = globalThis as unknown as { __nonnaBus?: Bus };
export const bus: Bus = (g.__nonnaBus ??= new Bus());
