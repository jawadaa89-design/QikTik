"use client";



import {

  createContext,

  useContext,

  useState,

  useCallback,

  useEffect,

  type ReactNode,

} from "react";

import type { MenuItem, MenuItemAdditional } from "@/lib/demo-data";



export type CartLine = {

  key: string;

  item: MenuItem;

  quantity: number;

  notes?: string;

  takeaway: boolean;

  additionals: MenuItemAdditional[];

};



type AddOptions = {

  notes?: string;

  quantity?: number;

  takeaway?: boolean;

  additionals?: MenuItemAdditional[];

};



type CartContextType = {

  lines: CartLine[];

  addItem: (item: MenuItem, options?: AddOptions) => void;

  removeItem: (lineKey: string) => void;

  updateQuantity: (lineKey: string, quantity: number) => void;

  total: number;

  count: number;

  clear: () => void;

};



const CartContext = createContext<CartContextType | null>(null);



export function makeLineKey(

  itemId: string,

  notes?: string,

  additionalIds: string[] = [],

  takeaway = false

) {

  const extras = [...additionalIds].sort().join(",");

  return `${itemId}::${(notes ?? "").trim()}::${extras}::${takeaway ? "1" : "0"}`;

}



export function lineUnitPrice(line: Pick<CartLine, "item" | "additionals">) {

  const extras = line.additionals.reduce((s, a) => s + parseFloat(a.price), 0);

  return parseFloat(line.item.price) + extras;

}



function normalizeLines(raw: unknown): CartLine[] {

  if (!Array.isArray(raw)) return [];

  return raw

    .map((l) => {

      const line = l as Partial<CartLine> & { item?: MenuItem };

      if (!line.item?.id) return null;

      const notes = line.notes?.trim() || undefined;

      const takeaway = Boolean(line.takeaway);

      const additionals = Array.isArray(line.additionals) ? line.additionals : [];

      return {

        key:

          line.key ??

          makeLineKey(

            line.item.id,

            notes,

            additionals.map((a) => a.id),

            takeaway

          ),

        item: line.item,

        quantity: Math.max(1, Number(line.quantity) || 1),

        notes,

        takeaway,

        additionals,

      } satisfies CartLine;

    })

    .filter(Boolean) as CartLine[];

}



function loadCart(storageKey: string): CartLine[] {

  if (typeof window === "undefined") return [];

  try {

    const raw = sessionStorage.getItem(`qiktik-cart:${storageKey}`);

    if (!raw) return [];

    return normalizeLines(JSON.parse(raw));

  } catch {

    return [];

  }

}



function saveCart(storageKey: string, lines: CartLine[]) {

  try {

    sessionStorage.setItem(`qiktik-cart:${storageKey}`, JSON.stringify(lines));

  } catch {

    // ignore quota / private mode

  }

}



export function CartProvider({

  children,

  storageKey = "default",

}: {

  children: ReactNode;

  storageKey?: string;

}) {

  const [lines, setLines] = useState<CartLine[]>([]);

  const [hydrated, setHydrated] = useState(false);



  useEffect(() => {

    setLines(loadCart(storageKey));

    setHydrated(true);

  }, [storageKey]);



  useEffect(() => {

    if (!hydrated) return;

    saveCart(storageKey, lines);

  }, [lines, storageKey, hydrated]);



  const addItem = useCallback((item: MenuItem, options?: AddOptions) => {

    const notes = options?.notes?.trim() || undefined;

    const qty = Math.max(1, options?.quantity ?? 1);

    const takeaway = Boolean(options?.takeaway);

    const additionals = options?.additionals ?? [];

    const key = makeLineKey(

      item.id,

      notes,

      additionals.map((a) => a.id),

      takeaway

    );



    setLines((prev) => {

      const existing = prev.find((l) => l.key === key);

      if (existing) {

        return prev.map((l) =>

          l.key === key ? { ...l, quantity: l.quantity + qty } : l

        );

      }

      return [...prev, { key, item, quantity: qty, notes, takeaway, additionals }];

    });

  }, []);



  const removeItem = useCallback((lineKey: string) => {

    setLines((prev) => prev.filter((l) => l.key !== lineKey));

  }, []);



  const updateQuantity = useCallback((lineKey: string, quantity: number) => {

    if (quantity <= 0) {

      setLines((prev) => prev.filter((l) => l.key !== lineKey));

      return;

    }

    setLines((prev) =>

      prev.map((l) => (l.key === lineKey ? { ...l, quantity } : l))

    );

  }, []);



  const clear = useCallback(() => setLines([]), []);



  const total = lines.reduce(

    (sum, l) => sum + lineUnitPrice(l) * l.quantity,

    0

  );

  const count = lines.reduce((sum, l) => sum + l.quantity, 0);



  return (

    <CartContext.Provider

      value={{ lines, addItem, removeItem, updateQuantity, total, count, clear }}

    >

      {children}

    </CartContext.Provider>

  );

}



export function useCart() {

  const ctx = useContext(CartContext);

  if (!ctx) throw new Error("useCart must be used within CartProvider");

  return ctx;

}


