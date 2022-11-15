import { writable } from "svelte/store";

export const summaries = writable([]);
export const summary_text = writable("");
export const summary_index = writable(0);
export const summary_id = writable(0);
export const submissions_left = writable(0);
export const custom_settings = writable(summaryengine_settings);
