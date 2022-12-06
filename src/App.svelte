<script>
    import { onMount } from 'svelte';
    import { apiGet } from './libs/ajax.js';

    import PostReview from './post_edit/PostReview.svelte';

    let types = [];

    onMount(async () => {
        try {
            types = await apiGet(`/summaryengine/v1/types`);
        } catch (e) {
            console.error(e);
        }
    });
</script>

{#each types as type}
    <PostReview type={type} />
{/each}