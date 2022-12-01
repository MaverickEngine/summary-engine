<script>
    import { search } from '../stores.js';
    import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();
</script>
<form class="search-box" on:submit|preventDefault={() => dispatch("search")}>
    <label class="screen-reader-text" for="post-search-input">Search Articles:</label>
    <input type="search" bind:value={$search} id="post-search-input" name="s">
    <input type="submit" id="search-submit" class="button" value="Search">
</form>