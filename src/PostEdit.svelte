<script lang="ts">
    import { onMount } from 'svelte';
    import { apiGet } from 'wp-ajax';

    import type { IType } from './types/TypeInterface.js';

    import Summary from './components/Summary.svelte';

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
    <div class="summaryengine-summary">
        <Summary type={type} />
    </div>
{/each}

<style>
    .summaryengine-summary {
        padding-bottom: 20px;
        border-bottom: 1px solid #ccc;
    }
</style>