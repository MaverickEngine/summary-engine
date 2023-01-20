<script lang="ts">
    import { onMount } from 'svelte';
    import { apiGet } from './libs/ajax.js';

    import type { IType } from './types/TypeInterface.js';

    import PostReview from './components/PostReview.svelte';

    let types: IType[] = [];

    onMount(async () => {
        try {
            types = await apiGet(`/summaryengine/v1/types`);
        } catch (e) {
            console.error(e);
        }
    });
</script>

{#each types as type}
    <div class="summaryengine-postreview">
        <PostReview type={type} />
    </div>
{/each}
<div class="summaryengine-link">
    <a href="/wp-admin/admin.php?page=summaryengine">Quickly generate and review summaries for multiple articles here</a>
</div>

<style>
    .summaryengine-link {
        margin: 20px 0;        
    }

    .summaryengine-postreview {
        padding-bottom: 20px;
        border-bottom: 1px solid #ccc;
    }
</style>