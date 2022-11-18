<script>
import { onMount } from 'svelte';
import { apiGet } from '../libs/ajax.js';
import DayChart from "./components/DayChart.svelte";
import PieChart from "./components/PieChart.svelte";

let good_summaries = [];
let bad_summaries = [];
let counts;

onMount(async () => {
    try {
        const reports = await apiGet(`summaryengine/v1/reports`);
        good_summaries = reports.good_summaries;
        bad_summaries = reports.bad_summaries;
        counts = reports.counts;
    } catch (e) {
        console.error(e);
    }
});

</script>
<!-- Path: wp-content/plugins/summary-engine/src/reports/Reports.svelte -->

<div id="summaryEngineGraphs">
    <div id="summaryEngineDayChart">
        <h3>Day Chart</h3>
        <DayChart />
    </div>
    <div id="summaryEnginePieChart">
        <h3>Ratings</h3>
        <PieChart 
            good={counts?.find(d => Number(d.rating) === 1).count || 0} 
            bad={counts?.find(d => Number(d.rating) === -1).count || 0}
            unrated={counts?.find(d => Number(d.rating) === 0).count || 0}
        />
    </div>
</div>
<h3>Good Summaries</h3>
<table class="wp-list-table widefat fixed striped table-view-list">
    <thead>
        <tr>
            <th>Post Title</th>
            <th>Summary</th>
            <th>Prompt</th>
            <th>User</th>
        </tr>
    </thead>
    <tbody>
        {#each good_summaries as summary}
        <tr>
            <td><a href="{summary.post_permalink}">{summary.post_title}</a></td>
            <td>{summary.summary}</td>
            <td>{summary.prompt}</td>
            <td>{summary.user}</td>
        </tr>
        {/each}
    </tbody>
</table>

<h3>Bad Summaries</h3>
<table class="wp-list-table widefat fixed striped table-view-list">
    <thead>
        <tr>
            <th>Post Title</th>
            <th>Summary</th>
            <th>Prompt</th>
            <th>User</th>
        </tr>
    </thead>
    <tbody>
        {#each bad_summaries as summary}
        <tr>
            <td><a href="{summary.post_permalink}">{summary.post_title}</a></td>
            <td>{summary.summary}</td>
            <td>{summary.prompt}</td>
            <td>{summary.user}</td>
        </tr>
        {/each}
    </tbody>
</table>

<style lang="scss">
    #summaryEngineGraphs {
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        align-items: center;
        margin-bottom: 20px;
    }
    #summaryEngineDayChart {
        width: 600px;
    }

    #summaryEnginePieChart {
        height: 350px;
        width: 300px;
    }
</style>