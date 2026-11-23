/** Restore menu + tables without wiping pickup tickets / venue. */
process.env.SEED_MENU_ONLY = "1";
await import("./seed");
