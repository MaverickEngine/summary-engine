<script lang="ts">
    import { Pie } from 'svelte-chartjs';
    import {
        Chart as ChartJS,
        Title,
        Tooltip,
        Legend,
        ArcElement,
        CategoryScale,
        Colors,
    } from 'chart.js';

    ChartJS.register(
        Title,
        Tooltip,
        Legend,
        ArcElement,
        CategoryScale,
        Colors,
    );

    export let good = 10;
    export let bad = 20;
    export let unrated = 30;
</script>

<div class="chart">
    <Pie data={{ labels: ['Approved', 'Disapproved', 'Unapproved'],
        datasets: [
        {
            data: [good, bad, unrated],

        },
        ], }}
        options={{ responsive: true }}
    />
</div>

<style lang="less">
    
</style>