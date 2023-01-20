<script lang="ts">
    import type {ISettings} from '../types/SettingsInterface';
    import OpenAiTypeSettings from './OpenAITypeSettings.svelte';
    import { slide } from 'svelte/transition';

    export let settings : ISettings;
    export let visible = false;
</script>

<div class="summaryengine-settings-container">
    {#if visible}
    <div class="summaryengine-settings" transition:slide={{ duration: 1000 }}>
        <table class="form-table" >
            <OpenAiTypeSettings bind:settings="{settings}" />
        </table>
    </div>
    {/if}
</div>