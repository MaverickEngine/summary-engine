<script>
import { onMount } from 'svelte';
import { apiGet } from '../libs/ajax.js';
import DayChart from "./components/DayChart.svelte";
import PieChart from "./components/PieChart.svelte";

let good_summaries = [];
let bad_summaries = [];
let counts;
let types = [];

onMount(async () => {
    try {
        types = await apiGet(`summaryengine/v1/types`);
        const reports = await apiGet(`summaryengine/v1/reports`);
        good_summaries = reports.good_summaries;
        bad_summaries = reports.bad_summaries;
        counts = reports.counts;
        console.log(counts);
    } catch (e) {
        console.error(e);
    }
});

</script>
<!-- Path: wp-content/plugins/summary-engine/src/reports/Reports.svelte -->

<div class="summaryEngineCard">
    <div class="summaryEngineGraphs">
        <div class="summaryEngineDayChart">
            <h3>Day Chart</h3>
            <DayChart />
        </div>
        <div class="summaryEnginePieChart">
            <h3>Ratings</h3>
            <PieChart 
                good={counts?.filter(d => Number(d.rating) === 1)?.reduce((prev, curr) => prev + Number(curr.count), 0) || 0} 
                bad={counts?.filter(d => Number(d.rating) === -1)?.reduce((prev, curr) => prev + Number(curr.count), 0) || 0}
                unrated={counts?.filter(d => Number(d.rating) === 0)?.reduce((prev, curr) => prev + Number(curr.count), 0) || 0}
            />
        </div>
    </div>
</div>

{#each types as type}
<div class="summaryEngineCard">
    <h2>{type.name}</h2>
    <div class="summaryEngineGraphs">
        <div class="summaryEngineDayChart">
            <h3>{type.name} Day Chart</h3>
            <DayChart type_id={type.ID} />
        </div>
        <div class="summaryEnginePieChart">
            <h3>{type.name} Ratings</h3>
            <PieChart 
                good={counts?.filter(d => Number(d.type_id) === Number(type.ID))?.filter(d => Number(d.rating) === 1)?.reduce((prev, curr) => prev + Number(curr.count), 0) || 0} 
                bad={counts?.filter(d => Number(d.type_id) === Number(type.ID))?.filter(d => Number(d.rating) === -1)?.reduce((prev, curr) => prev + Number(curr.count), 0) || 0}
                unrated={counts?.filter(d => Number(d.type_id) === Number(type.ID))?.filter(d => Number(d.rating) === 0)?.reduce((prev, curr) => prev + Number(curr.count), 0) || 0}
            />
        </div>
    </div>
</div>
{/each}

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

<style lang="less">
    .summaryEngineGraphs {
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        align-items: center;
        margin-bottom: 20px;
    }

    .summaryEngineDayChart {
        width: 600px;
    }

    .summaryEnginePieChart {
        height: 350px;
        width: 300px;
    }

    .summaryEngineCard {
        margin-bottom: 20px;
        border-radius: 3px;
        border: 1px solid #e5e5e5;
        background-color: #fff;
        box-shadow: 0 1px 1px rgba(0,0,0,.04);
        padding: 20px;
    }
</style>