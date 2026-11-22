export type StationRoute = "MAIN_KITCHEN" | "MEAT_KITCHEN" | "BAR" | "HOOKAH";

export type PrintJob = {
  orderId: string;
  tableNumber: number;
  section: string;
  orderNumber: number;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string;
    route: StationRoute;
  }>;
  createdAt: Date;
};

export type PrinterConfig = {
  mainKitchen: { type: "usb" | "network"; address: string };
  meatKitchen: { type: "usb" | "network"; address: string };
  bar: { type: "usb" | "network"; address: string };
  hookah: { type: "usb" | "network"; address: string };
};

const STATION_LABELS: Record<StationRoute, string> = {
  MAIN_KITCHEN: "MAIN KITCHEN",
  MEAT_KITCHEN: "MEAT KITCHEN",
  BAR: "BAR",
  HOOKAH: "HOOKAH",
};

/** Format ESC/POS ticket content */
export function formatTicket(job: PrintJob, station: StationRoute): string {
  const lines = [
    "================================",
    `  ${STATION_LABELS[station]}`,
    `  ${job.section} · TABLE ${job.tableNumber}  #${job.orderNumber}`,
    `  ${job.createdAt.toLocaleTimeString()}`,
    "================================",
    "",
  ];

  for (const item of job.items) {
    lines.push(`${item.quantity}x ${item.name}`);
    if (item.notes) lines.push(`   ** ${item.notes} **`);
    lines.push("");
  }

  lines.push("================================", "");
  return lines.join("\n");
}

const queue: PrintJob[] = [];

function printerForStation(
  station: StationRoute,
  config: PrinterConfig
): { label: string; address: string } {
  switch (station) {
    case "MAIN_KITCHEN":
      return { label: "Main kitchen", address: config.mainKitchen.address };
    case "MEAT_KITCHEN":
      return { label: "Meat kitchen", address: config.meatKitchen.address };
    case "BAR":
      return { label: "Bar", address: config.bar.address };
    case "HOOKAH":
      return { label: "Hookah", address: config.hookah.address };
  }
}

export function enqueuePrint(job: PrintJob, config: PrinterConfig): void {
  const stations = new Set(job.items.map((i) => i.route));

  for (const station of stations) {
    const items = job.items.filter((i) => i.route === station);
    const printer = printerForStation(station, config);
    console.log(`[print] ${printer.label} → ${printer.address}`);
    console.log(formatTicket({ ...job, items }, station));
  }

  queue.push(job);
}

export function getQueue(): PrintJob[] {
  return [...queue];
}
