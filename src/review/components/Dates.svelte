<script>
    import { apiGet } from 'wp-ajax';
    import { onMount } from 'svelte';
    import { selected_date } from '../stores.js';
    
    let months = [];
    const month_labels = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    onMount(async () => {
        try {
            const result = await apiGet(`/summaryengine/v1/post_months`);
            months = result;
            months = months.map(month => {
                month.label = month_labels[month.month - 1] + " " + month.year;
                return month;
            });
        } catch (err) {
            console.error(err);
        }
    });
</script>

<div class="alignleft actions">
    <label for="filter-by-date" class="screen-reader-text">Filter by date</label>
    <select name="m" id="filter-by-date" bind:value={$selected_date}>
        <option value="0" >All dates</option>
        {#each months as month}
            <option value="{month.year + month.month + ""}">{month.label}</option>
        {/each}
    </select>
    <input type="submit" name="filter_action" id="post-query-submit" class="button" value="Filter" on:click>		
</div>