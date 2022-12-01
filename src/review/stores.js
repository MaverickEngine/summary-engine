import { writable } from "svelte/store";

export const posts = writable([]);
export const types = writable([]);
export const selected_date = writable("0");
export const page = writable(1);
export const post_count = writable(0);
export const loading = writable(false);
export const search = writable("");